import { z } from 'zod';

export class ApiError extends Error {
  status: number; code: string; field: string | null;
  constructor(status: number, code: string, message: string, field: string | null = null) {
    super(message); this.status = status; this.code = code; this.field = field;
  }
}
export const uuid = z.uuid({ error: '사용자 또는 요청 ID 형식이 올바르지 않습니다.' });
export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) { const issue = result.error.issues[0]; throw new ApiError(400, 'VALIDATION_ERROR', issue.message, issue.path[0]?.toString() || null); }
  return result.data;
}
export function clientHeader(req: Request) {
  const value = req.headers.get('x-onefix-client-id');
  return value ? parse(uuid, value) : '';
}
export function checkIdentity(req: Request, id: string) {
  const header = clientHeader(req);
  if (header && header !== id) throw new ApiError(400, 'VALIDATION_ERROR', '사용자 정보가 일치하지 않습니다.');
}
export async function bodyBytes(req: Request, max: number) {
  if (Number(req.headers.get('content-length')) > max) throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '첨부 용량을 줄여 주세요.');
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, 'VALIDATION_ERROR', '요청 내용이 없습니다.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '첨부 용량을 줄여 주세요.'); }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function jsonBody(req: Request): Promise<unknown> {
  if (!req.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON 요청이 필요합니다.');
  const bytes = await bodyBytes(req, 64 * 1024);
  try { return JSON.parse(bytes.toString()); } catch { throw new ApiError(400, 'VALIDATION_ERROR', '요청 형식이 올바르지 않습니다.'); }
}
