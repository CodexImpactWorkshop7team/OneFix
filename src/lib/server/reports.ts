import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { symptoms, type DedupMethod, type ReportResult } from '../../types/domain.ts';
import { run, one, facility, issues, transaction, iso } from './db.ts';
import { findDuplicate } from './deduplication.ts';
import { ApiError, bodyBytes, checkIdentity, parse, uuid } from './validation.ts';

const reportSchema = z.object({
  requestId: uuid, clientId: uuid, facilityId: z.string().min(1).max(80), symptom: z.enum(symptoms),
  description: z.string().trim().min(5, '설명을 5자 이상 입력해 주세요.').max(500, '설명은 500자까지 입력할 수 있어요.'),
}).strict();
const globalLocks = globalThis as typeof globalThis & { onefixLocks?: Map<string, { tail: Promise<void>; waiting: number }> };
const locks = globalLocks.onefixLocks ||= new Map();
async function serialize<T>(id: string, work: () => Promise<T>): Promise<T> {
  const entry = locks.get(id) || { tail: Promise.resolve(), waiting: 0 };
  if (entry.waiting >= 6) throw new ApiError(503, 'SERVER_BUSY', '신고가 몰리고 있어요. 잠시 후 다시 시도해 주세요.');
  const before = entry.tail; let release!: () => void;
  entry.tail = new Promise<void>(r => { release = r; }); entry.waiting++; locks.set(id, entry);
  await before;
  try { return await work(); }
  finally { entry.waiting--; release(); if (!entry.waiting) locks.delete(id); }
}
type StoredReport = { id: string; issue_id: string; merged: number; dedup_method: DedupMethod; payload_hash: string };
function result(row: StoredReport): ReportResult {
  return { reportId: row.id, issueId: row.issue_id, merged: Boolean(row.merged), affectedCount: issues('i.id=?', [row.issue_id])[0].affectedCount,
    dedupMethod: row.dedup_method, noticeCode: row.dedup_method === 'mock' ? 'MOCK_MODE' : row.dedup_method === 'fallback' ? 'DEDUP_UNAVAILABLE' : null };
}
export async function submitReport(req: Request) {
  const type = req.headers.get('content-type') || '';
  if (!type.startsWith('multipart/form-data')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', '신고 폼 형식이 올바르지 않습니다.');
  const bytes = await bodyBytes(req, 6 * 1024 * 1024);
  let form: FormData;
  try { form = await new Response(new Uint8Array(bytes), { headers: { 'content-type': type } }).formData(); }
  catch { throw new ApiError(400, 'VALIDATION_ERROR', '신고 폼을 읽을 수 없습니다.'); }
  const fields: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (form.getAll(key).length > 1) throw new ApiError(400, 'VALIDATION_ERROR', '중복 입력 항목이 있습니다.', key);
    if (key !== 'photo') fields[key] = value;
  }
  const input = parse(reportSchema, fields); checkIdentity(req, input.clientId);
  if (!facility(input.facilityId)) throw new ApiError(404, 'FACILITY_NOT_FOUND', '시설을 찾을 수 없습니다.');
  const photo = form.get('photo'); let image: { data: Buffer; mime: string; extension: string } | null = null;
  if (photo !== null) {
    if (process.env.FEATURE_PHOTOS === 'false') throw new ApiError(400, 'PHOTO_DISABLED', '사진 첨부가 비활성화되어 있습니다.');
    if (typeof photo === 'string' || photo.size === 0) throw new ApiError(400, 'VALIDATION_ERROR', '사진 파일을 선택해 주세요.', 'photo');
    if (photo.size > 5 * 1024 * 1024) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '사진은 5MB까지 첨부할 수 있어요.', 'photo');
    const data = Buffer.from(await photo.arrayBuffer());
    const format = data.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? ['image/jpeg', 'jpg']
      : data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? ['image/png', 'png']
      : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' ? ['image/webp', 'webp'] : null;
    if (!format || photo.type !== format[0]) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JPEG, PNG, WebP 사진만 첨부할 수 있어요.', 'photo');
    image = { data, mime: format[0], extension: format[1] };
  }
  const hash = createHash('sha256').update(JSON.stringify([input.facilityId, input.clientId, input.symptom, input.description, image ? createHash('sha256').update(image.data).digest('hex') : null])).digest('hex');
  return serialize(input.facilityId, async () => {
    const previous = one<StoredReport>('SELECT * FROM reports WHERE request_id=?', input.requestId);
    if (previous) {
      if (previous.payload_hash !== hash) throw new ApiError(409, 'REQUEST_ID_CONFLICT', '수정된 내용은 새로 접수해 주세요.');
      return { status: 200, data: result(previous) };
    }
    const candidates = issues("i.facility_id=? AND i.status<>'resolved'", [input.facilityId]).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)).slice(0, 20);
    const match = await findDuplicate(input, candidates);
    let filePath: string | null = null;
    try {
      const stored = transaction(() => {
        let issueId = match.id; let method = match.method;
        if (issueId && issues("i.id=? AND i.status<>'resolved'", [issueId]).length === 0) { issueId = null; method = 'fallback'; }
        const merged = Boolean(issueId); const now = iso(Date.now());
        issueId ||= randomUUID();
        if (!merged) run('INSERT INTO issues (id,facility_id,symptom,description,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', issueId, input.facilityId, input.symptom, input.description, 'reported', now, now);
        const reportId = randomUUID();
        run('INSERT INTO reports VALUES (?,?,?,?,?,?,?,?,?,?)', reportId, issueId, input.clientId, input.requestId, hash, input.symptom, input.description, now, method, Number(merged));
        run('INSERT OR IGNORE INTO participations VALUES (?,?,?)', issueId, input.clientId, now);
        if (image) {
          const photoId = randomUUID(); const key = `${photoId}.${image.extension}`;
          const directory = resolve(process.env.UPLOAD_DIR || './data/uploads'); mkdirSync(directory, { recursive: true });
          filePath = resolve(directory, key); writeFileSync(filePath, image.data);
          run('INSERT INTO photos VALUES (?,?,?,?,?)', photoId, reportId, key, image.mime, image.data.length);
        }
        return { id: reportId, issue_id: issueId, merged: Number(merged), dedup_method: method, payload_hash: hash };
      });
      return { status: 201, data: result(stored) };
    } catch (error) {
      if (filePath) { try { unlinkSync(filePath); } catch {} }
      if (one<StoredReport>('SELECT * FROM reports WHERE request_id=?', input.requestId)) throw new ApiError(409, 'REQUEST_ID_CONFLICT', '같은 요청 ID가 이미 사용되었습니다.');
      throw error;
    }
  });
}
