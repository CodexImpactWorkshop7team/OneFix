import { createClient, type Client, type InValue, type InStatement, type Transaction } from '@libsql/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Facility, Issue, Status, Symptom } from '../../types/domain.ts';

const globalDb = globalThis as typeof globalThis & { onefixLibsql?: Promise<Client> };
const transactions = new AsyncLocalStorage<Transaction>();
export const remoteDatabase = () => Boolean(process.env.TURSO_DATABASE_URL);
export const DAY = 86_400_000;
export const KST = 9 * 60 * 60 * 1000;
export const midnight = (now = Date.now()) => Math.floor((now + KST) / DAY) * DAY - KST;
export const iso = (time: number) => new Date(time).toISOString();


export async function db(seed: 'demo' | 'live' | 'none' = 'demo'): Promise<Client> {
  if (!globalDb.onefixLibsql) globalDb.onefixLibsql = (async () => {
    const remote = process.env.TURSO_DATABASE_URL;
    if (process.env.VERCEL && (!remote || !/^libsql:\/\//.test(remote) || !process.env.TURSO_AUTH_TOKEN)) throw new Error('Configure remote Turso database before deploying');
    const path = resolve(/* turbopackIgnore: true */ process.env.SQLITE_PATH || './data/onefix.sqlite');
    if (!remote) mkdirSync(dirname(path), { recursive: true });
    const connection = createClient({ url: remote || `file:${path}`, authToken: process.env.TURSO_AUTH_TOKEN });
    try {
      const schema = [readFileSync(resolve('docs/schema.sql'), 'utf8'), readFileSync(resolve('docs/questions-schema.sql'), 'utf8'), readFileSync(resolve('docs/deployment-schema.sql'), 'utf8')]
        .map(sql => sql.replace(/CREATE TABLE (?!IF NOT EXISTS)/g, 'CREATE TABLE IF NOT EXISTS ').replace(/CREATE INDEX (?!IF NOT EXISTS)/g, 'CREATE INDEX IF NOT EXISTS ')).join('\n');
      await connection.executeMultiple(schema);
      if (seed !== 'none') await seedData(connection, seed === 'demo' && !remote);
      return connection;
    } catch (error) { connection.close(); throw error; }
  })().catch(error => { globalDb.onefixLibsql = undefined; throw error; });
  return globalDb.onefixLibsql;
}
async function executor() { return transactions.getStore() || await db(); }
export async function all<T>(sql: string, ...args: InValue[]): Promise<T[]> { return (await (await executor()).execute({ sql, args })).rows as unknown as T[]; }
export async function one<T>(sql: string, ...args: InValue[]): Promise<T | undefined> { return (await all<T>(sql, ...args))[0]; }
export async function run(sql: string, ...args: InValue[]) { return (await executor()).execute({ sql, args }); }
export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  if (transactions.getStore()) return work();
  const tx = await (await db()).transaction('write');
  try { const value = await transactions.run(tx, work); await tx.commit(); return value; }
  catch (error) { await tx.rollback(); throw error; }
  finally { tx.close(); }
}

export const facilityColumns = 'id, name, location, kind';
export async function facilities() { return (await all<Facility>(`SELECT ${facilityColumns} FROM facilities ORDER BY id`)); }
export async function facility(id: string) { return (await one<Facility>(`SELECT ${facilityColumns} FROM facilities WHERE id=?`, id)); }
export async function datasetKind(): Promise<'live' | 'synthetic'> {
  return (await one<{ value: string }>("SELECT value FROM app_metadata WHERE key='dataset_kind'"))?.value === 'synthetic' ? 'synthetic' : 'live';
}

type IssueRow = { id: string; facility_id: string; symptom: Symptom; description: string; status: Status; eta_text: string | null; created_at: string; updated_at: string; resolved_at: string | null; affected_count: number; participated: number };
export async function issues(where = '1=1', params: InValue[] = [], clientId = ''): Promise<Issue[]> {
  return (await all<IssueRow>(`SELECT i.*, (SELECT COUNT(*) FROM participations p WHERE p.issue_id=i.id) AS affected_count,
    EXISTS(SELECT 1 FROM participations p WHERE p.issue_id=i.id AND p.client_id=?) AS participated
    FROM issues i WHERE ${where}`, clientId, ...params)).map(row => ({
    id: row.id, facilityId: row.facility_id, symptom: row.symptom, description: row.description,
    status: row.status, etaText: row.eta_text, createdAt: row.created_at, updatedAt: row.updated_at,
    resolvedAt: row.resolved_at, affectedCount: row.affected_count, hasParticipated: Boolean(row.participated),
  }));
}
export const sortOpen = (a: Issue, b: Issue) => b.affectedCount - a.affectedCount || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
export const sortResolved = (a: Issue, b: Issue) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '') || a.id.localeCompare(b.id);

export async function seedData(connection: Client, synthetic: boolean) {
  if ((await connection.execute('SELECT id FROM facilities LIMIT 1')).rows.length) return;
  const statements: InStatement[] = [];
  const recordDays = new Set<string>();
  const collect = (sql: string, ...args: InValue[]) => statements.push({ sql, args });
  const t = midnight();
  const seeds = [
    { id: 'printer-a', name: '프린터 A', location: '도서관 · 1층', kind: 'printer', symptom: 'not_working', description: '출력 버튼을 눌러도 종이가 안 나와요', age: 60, days: [35, 25, 15, 5], weeks: [4, 6, 8, 10], people: 8 },
    { id: 'ac-307', name: '307호 에어컨', location: '학생회관 · 3층', kind: 'air_conditioner', symptom: 'poor_performance', description: '에어컨에서 찬 바람이 안 나와요', age: 60, days: [35, 20, 5], weeks: [2, 2, 2, 2], people: 5 },
    { id: 'water-1f', name: '1층 정수기', location: '학생회관 · 1층', kind: 'water_dispenser', symptom: 'not_working', description: '정수기에서 물이 나오지 않아요', age: 10, days: [5], weeks: [0, 0, 0, 2], people: 2 },
  ];

    collect('INSERT OR REPLACE INTO app_metadata VALUES (?,?)', 'dataset_kind', synthetic ? 'synthetic' : 'live');
    for (const f of seeds) {
      collect('INSERT OR IGNORE INTO facilities VALUES (?,?,?,?,?,?)', f.id, f.name, f.location, f.kind, iso(synthetic ? t - f.age * DAY : Date.now()), iso(Date.now()));
      if (!synthetic) continue;
      const history = f.days.map((day, index) => ({ id: `demo-${f.id}-${index}`, at: t - day * DAY + 3600000, end: index < f.days.length - 1 ? t - f.days[index + 1] * DAY + 3600000 : Infinity }));
      const weekly = [0, 0, 0, 0];
      const client = (n: number) => `demo-${f.id}-person-${n % f.people}`;
      const addReport = (issueId: string, at: number, clientId: string) => {
        const id = randomUUID();
        recordDays.add(`${issueId}:${clientId}:${iso(at + KST).slice(0,10)}`);
        collect('INSERT INTO reports VALUES (?,?,?,?,?,?,?,?,?,?)', id, issueId, clientId, randomUUID(), `seed-${id}`, f.symptom, f.description, iso(at), 'none', 0);
        collect('INSERT OR IGNORE INTO participations VALUES (?,?,?)', issueId, clientId, iso(at));
        const bucket = Math.floor((at - (t - 28 * DAY)) / (7 * DAY));
        if (bucket >= 0 && bucket < 4) weekly[bucket]++;
      };
      history.forEach((item, index) => {
        const last = index === history.length - 1;
        const status = last ? (f.id === 'ac-307' ? 'acknowledged' : 'reported') : 'resolved';
        collect('INSERT INTO issues VALUES (?,?,?,?,?,?,?,?,?)', item.id, f.id, f.symptom, f.description, status, last && f.id === 'ac-307' ? '오늘 18:00' : null, iso(item.at), iso(last ? item.at : item.end), last ? null : iso(item.end));
        addReport(item.id, item.at, client(0));
      });
      for (let w = 0; w < 4; w++) {
        let offset = 0;
        while (weekly[w] < f.weeks[w]) {
          const at = t - (28 - w * 7) * DAY + (offset % 7) * DAY + 12 * 3600000;
          const item = history.find(h => h.at <= at && h.end > at);
          const c = client(1 + Math.floor(offset / 7));
          offset++;
          if (!item) continue;
          const date = iso(at + KST).slice(0, 10);
          const exists = recordDays.has(`${item.id}:${c}:${date}`);
          if (!exists) addReport(item.id, at, c);
        }
      }
      for (let p = 0; p < f.people; p++) collect('INSERT OR IGNORE INTO participations VALUES (?,?,?)', history.at(-1)!.id, client(p), iso(t - DAY));
    }
  await connection.batch(statements, 'write');
}
