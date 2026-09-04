import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { all, one, run, transaction, issues, facilities, facility, sortOpen, sortResolved, datasetKind, iso } from '@/lib/server/db';
import { ApiError, parse, uuid, clientHeader, checkIdentity, jsonBody } from '@/lib/server/validation';
import { submitReport } from '@/lib/server/reports';
import { dedupMode } from '@/lib/server/deduplication';
import { handleQuestions } from '@/lib/server/questions';
import { predictions } from '@/lib/server/predictions';
import { statuses, type Report, type Symptom, type DedupMethod } from '@/types/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const notFound = () => { throw new ApiError(404, 'ISSUE_NOT_FOUND', '고장 요청을 찾을 수 없습니다.'); };

async function handle(req: Request, context: Context) {
  try {
    const segments = (await context.params).path;
    const path = segments.join('/'); const method = req.method; const clientId = clientHeader(req);
    if (method !== 'GET') {
      const origin = req.headers.get('origin');
      if (origin && new URL(origin).host !== new URL(req.url).host) throw new ApiError(403, 'FORBIDDEN', '이 사이트에서 다시 접수해 주세요.');
    }
    const questionResponse = await handleQuestions(req, segments, clientId);
    if (questionResponse) return questionResponse;
    if (method === 'GET' && path === 'facilities') {
      const base = (process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
      return json({ facilities: facilities().map(f => ({ ...f, openIssueCount: issues("i.facility_id=? AND i.status<>'resolved'", [f.id]).length, url: `${base}/facilities/${f.id}` })),
        meta: { dedupMode: dedupMode(), datasetKind: datasetKind(), features: { photos: process.env.FEATURE_PHOTOS !== 'false', predictions: process.env.FEATURE_PREDICTIONS !== 'false' } } });
    }
    if (method === 'GET' && segments[0] === 'facilities' && segments.length === 2) {
      const item = facility(segments[1]);
      if (!item) throw new ApiError(404, 'FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.');
      const list = issues('i.facility_id=?', [item.id], clientId);
      return json({ facility: item, issues: list.filter(i => i.status !== 'resolved').sort(sortOpen), recentlyResolvedIssues: list.filter(i => i.status === 'resolved').sort(sortResolved).slice(0, 3) });
    }
    if (method === 'POST' && path === 'reports') { const reply = await submitReport(req); return json(reply.data, reply.status); }
    if (method === 'POST' && segments[0] === 'issues' && segments[2] === 'participations' && segments.length === 3) {
      const input = parse(z.object({ clientId: uuid }).strict(), await jsonBody(req)); checkIdentity(req, input.clientId);
      return json(transaction(() => {
        const issue = issues('i.id=?', [segments[1]], input.clientId)[0]; if (!issue) return notFound();
        if (issue.status === 'resolved') throw new ApiError(409, 'ISSUE_RESOLVED', '이미 해결된 고장이에요. 최신 상태를 확인해 주세요.');
        run('INSERT OR IGNORE INTO participations VALUES (?,?,?)', issue.id, input.clientId, iso(Date.now()));
        return { issueId: issue.id, affectedCount: issues('i.id=?', [issue.id])[0].affectedCount, alreadyParticipated: issue.hasParticipated };
      }));
    }
    if (method === 'PATCH' && segments[0] === 'issues' && segments.length === 2) {
      const input = parse(z.object({ status: z.enum(statuses), etaText: z.string().trim().max(80, '예상 처리는 80자까지 입력할 수 있어요.').nullable() }).strict(), await jsonBody(req));
      return json(transaction(() => {
        const issue = issues('i.id=?', [segments[1]], clientId)[0]; if (!issue) return notFound();
        if (statuses.indexOf(input.status) < statuses.indexOf(issue.status)) throw new ApiError(409, 'INVALID_STATUS_TRANSITION', '이전 처리 단계로 되돌릴 수 없어요.');
        const now = iso(Date.now());
        run('UPDATE issues SET status=?,eta_text=?,updated_at=?,resolved_at=? WHERE id=?', input.status, input.status === 'resolved' ? null : input.etaText || null, now, input.status === 'resolved' ? issue.resolvedAt || now : null, issue.id);
        return { issue: issues('i.id=?', [issue.id], clientId)[0] };
      }));
    }
    if (method === 'GET' && path === 'admin/predictions') {
      if (process.env.FEATURE_PREDICTIONS === 'false') throw new ApiError(404, 'FEATURE_DISABLED', '예측 기능이 비활성화되어 있습니다.');
      return json(predictions());
    }
    if (method === 'GET' && path === 'admin/issues') {
      const state = new URL(req.url).searchParams.get('state') || 'open';
      if (!['open', 'resolved'].includes(state)) throw new ApiError(400, 'VALIDATION_ERROR', '목록 상태가 올바르지 않습니다.');
      const list = issues('1=1', [], clientId);
      return json({ issues: list.filter(i => state === 'open' ? i.status !== 'resolved' : i.status === 'resolved').sort(state === 'open' ? sortOpen : sortResolved).map(i => ({ ...i, facility: facility(i.facilityId) })),
        counts: { open: list.filter(i => i.status !== 'resolved').length, inProgress: list.filter(i => i.status === 'in_progress').length, resolved: list.filter(i => i.status === 'resolved').length } });
    }
    if (method === 'GET' && segments[0] === 'admin' && segments[1] === 'issues' && segments.length === 3) {
      const issue = issues('i.id=?', [segments[2]], clientId)[0]; if (!issue) return notFound();
      type Row = { id: string; issue_id: string; symptom: Symptom; description: string; created_at: string; dedup_method: DedupMethod; merged: number; photo_id: string | null; mime_type: string; byte_size: number };
      const reports: Report[] = all<Row>(`SELECT r.*,p.id AS photo_id,p.mime_type,p.byte_size FROM reports r LEFT JOIN photos p ON p.report_id=r.id WHERE r.issue_id=? ORDER BY r.created_at,r.id`, issue.id)
        .map(r => ({ id: r.id, issueId: r.issue_id, symptom: r.symptom, description: r.description, createdAt: r.created_at, dedupMethod: r.dedup_method, merged: Boolean(r.merged), photo: r.photo_id ? { id: r.photo_id, url: `/api/uploads/${r.photo_id}`, mimeType: r.mime_type, byteSize: r.byte_size } : null }));
      return json({ issue, facility: facility(issue.facilityId), reports });
    }
    if (method === 'GET' && segments[0] === 'uploads' && segments.length === 2) {
      if (process.env.FEATURE_PHOTOS === 'false') throw new ApiError(404, 'FEATURE_DISABLED', '사진 기능이 비활성화되어 있습니다.');
      const row = one<{ storage_key: string; mime_type: string }>('SELECT storage_key,mime_type FROM photos WHERE id=?', segments[1]);
      if (!row) throw new ApiError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없습니다.');
      let bytes: Buffer;
      try { bytes = readFileSync(resolve(process.env.UPLOAD_DIR || './data/uploads', row.storage_key)); }
      catch { throw new ApiError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없습니다.'); }
      return new Response(new Uint8Array(bytes), { headers: { 'Content-Type': row.mime_type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    return json({ error: { code: 'NOT_FOUND', message: '요청한 경로를 찾을 수 없습니다.', field: null } }, 404);
  } catch (error) {
    if (error instanceof ApiError) {
      const response = json({ error: { code: error.code, message: error.message, field: error.field } }, error.status);
      if (error.status === 503) response.headers.set('Retry-After', '3');
      return response;
    }
    const busy = error instanceof Error && error.message.includes('database is locked');
    console.error('[onefix] Request failed:', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: { code: busy ? 'SERVER_BUSY' : 'STORAGE_ERROR', message: busy ? '잠시 후 다시 시도해 주세요.' : '저장소에 연결하지 못했어요. 다시 시도해 주세요.', field: null } }, busy ? 503 : 500);
  }
}
export { handle as GET, handle as POST, handle as PATCH };
