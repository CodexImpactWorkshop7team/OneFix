let memoryId = '';
export function makeId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function clientId() {
  if (!memoryId) {
    try { memoryId = localStorage.getItem('onefix.clientId') || ''; } catch {}
    if (!memoryId) {
      memoryId = makeId();
      try { localStorage.setItem('onefix.clientId', memoryId); }
      catch { window.dispatchEvent(new Event('onefix-storage-unavailable')); }
    }
  }
  return memoryId;
}
export class RequestError extends Error {
  code: string;
  constructor(message: string, code: string) { super(message); this.code = code; }
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-OneFix-Client-Id', clientId());
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  let response: Response;
  try { response = await fetch(`/api/${path}`, { ...init, headers, cache: 'no-store', signal: init.signal || AbortSignal.timeout(60000) }); }
  catch { throw new RequestError('연결이 지연되고 있어요. 입력한 내용은 유지됩니다. 다시 시도해 주세요.', 'NETWORK_ERROR'); }
  const data = await response.json();
  if (!response.ok) throw new RequestError(data.error?.message || '요청을 처리하지 못했어요.', data.error?.code || 'UNKNOWN');
  return data as T;
}
