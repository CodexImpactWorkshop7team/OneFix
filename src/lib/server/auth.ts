import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { one, run, transaction } from './db';
import { ApiError, jsonBody, parse } from './validation';

export const sessionCookie = 'onefix_admin';
const lifetime = 8 * 60 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = promisify(scrypt);
const configuredHash = () => process.env.ADMIN_PASSWORD_HASH || '';
const username = () => process.env.ADMIN_USERNAME || 'admin';
export function authConfigured() { return /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(configuredHash()); }
const credentialVersion = () => hash(`${username()}:${configuredHash()}`);
function tokenFromRequest(req: Request) {
  return (req.headers.get('cookie') || '').split(';').map(p => p.trim()).find(p => p.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1) || '';
}
export async function validSession(token: string) {
  if (!authConfigured() || !/^[a-f0-9]{64}$/.test(token)) return false;
  const session = await one<{ expires_at: number; credential_version: string }>('SELECT expires_at,credential_version FROM admin_sessions WHERE token_hash=?', hash(token));
  return Boolean(session && session.expires_at > Date.now() && session.credential_version === credentialVersion());
}
export async function requireAdmin(req: Request) {
  if (!await validSession(tokenFromRequest(req))) throw new ApiError(401, 'UNAUTHORIZED', '관리자 로그인이 필요합니다.');
}
function reply(data: unknown, cookie?: string) {
  return Response.json(data, { headers: { 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) } });
}
function cookie(token: string, maxAge: number, req: Request) {
  const secure = process.env.VERCEL || new URL(req.url).protocol === 'https:';
  return `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
export async function handleAuth(req: Request, path: string): Promise<Response | null> {
  if (path === 'auth/session' && req.method === 'GET') return reply({ authenticated: await validSession(tokenFromRequest(req)), configured: authConfigured() });
  if (path === 'auth/logout' && req.method === 'POST') {
    const token = tokenFromRequest(req);
    if (token) await run('DELETE FROM admin_sessions WHERE token_hash=?', hash(token));
    return reply({ authenticated: false }, cookie('', 0, req));
  }
  if (path !== 'auth/login' || req.method !== 'POST') return null;
  if (!authConfigured()) throw new ApiError(503, 'AUTH_NOT_CONFIGURED', '관리자 계정 설정이 필요합니다. 서버에서 npm run admin:setup을 실행해 주세요.');
  const input = parse(z.object({ username: z.string().trim().min(1).max(100), password: z.string().min(1).max(256) }).strict(), await jsonBody(req));
  // Vercel overwrites x-vercel-forwarded-for. Other deployments share a local bucket.
  const source = process.env.VERCEL ? req.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown' : 'local';
  const bucket = hash(`admin-login:${source}`), now = Date.now();
  const accepted = await transaction(async () => {
    await run('DELETE FROM login_attempts WHERE expires_at<=?', now);
    const result = await run(`INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=attempts+1 WHERE attempts<10`, bucket, now + 15 * 60 * 1000);
    return result.rowsAffected === 1;
  });
  if (!accepted) throw new ApiError(429, 'LOGIN_RATE_LIMITED', '로그인 시도가 많아요. 15분 후 다시 시도해 주세요.');
  const [, salt, expected] = configuredHash().split(':');
  const actual = await derive(input.password, salt, 64) as Buffer;
  if (!timingSafeEqual(actual, Buffer.from(expected, 'hex')) || input.username !== username()) throw new ApiError(401, 'INVALID_CREDENTIALS', '아이디 또는 비밀번호를 확인해 주세요.');
  const token = randomBytes(32).toString('hex');
  await transaction(async () => {
    await run('DELETE FROM login_attempts WHERE id=?', bucket);
    await run('DELETE FROM admin_sessions WHERE expires_at<=?', now);
    const previous = tokenFromRequest(req);
    if (previous) await run('DELETE FROM admin_sessions WHERE token_hash=?', hash(previous));
    await run('INSERT INTO admin_sessions VALUES (?,?,?)', hash(token), credentialVersion(), now + lifetime * 1000);
  });
  return reply({ authenticated: true }, cookie(token, lifetime, req));
}
