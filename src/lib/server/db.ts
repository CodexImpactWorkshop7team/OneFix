import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Facility, Issue, Status, Symptom } from '../../types/domain.ts';

const globalDb = globalThis as typeof globalThis & { onefixDb?: DatabaseSync };
export const DAY = 86_400_000;
export const KST = 9 * 60 * 60 * 1000;
export const midnight = (now = Date.now()) => Math.floor((now + KST) / DAY) * DAY - KST;
export const iso = (time: number) => new Date(time).toISOString();

export function db(seed: 'demo' | 'live' | 'none' = 'demo') {
  if (!globalDb.onefixDb) {
    const path = resolve(process.env.SQLITE_PATH || './data/onefix.sqlite');
    mkdirSync(dirname(path), { recursive: true });
    const connection = new DatabaseSync(path);
    connection.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000;');
    if (!connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='facilities'").get()) {
      connection.exec(readFileSync(resolve('docs/schema.sql'), 'utf8'));
    }
    globalDb.onefixDb = connection;
    if (seed !== 'none' && (connection.prepare('SELECT COUNT(*) AS n FROM facilities').get()?.n === 0)) seedData(connection, seed === 'demo');
  }
  return globalDb.onefixDb;
}

export function all<T>(sql: string, ...params: SQLInputValue[]): T[] { return db().prepare(sql).all(...params) as T[]; }
export function one<T>(sql: string, ...params: SQLInputValue[]): T | undefined { return db().prepare(sql).get(...params) as T | undefined; }
export function run(sql: string, ...params: SQLInputValue[]) { return db().prepare(sql).run(...params); }
export function transaction<T>(work: () => T): T {
  const connection = db();
  connection.exec('BEGIN IMMEDIATE');
  try { const result = work(); connection.exec('COMMIT'); return result; }
  catch (error) { connection.exec('ROLLBACK'); throw error; }
}

export const facilityColumns = 'id, name, location, kind';
export function facilities() { return all<Facility>(`SELECT ${facilityColumns} FROM facilities ORDER BY id`); }
export function facility(id: string) { return one<Facility>(`SELECT ${facilityColumns} FROM facilities WHERE id=?`, id); }
export function datasetKind(): 'live' | 'synthetic' {
  return one<{ value: string }>("SELECT value FROM app_metadata WHERE key='dataset_kind'")?.value === 'synthetic' ? 'synthetic' : 'live';
}

type IssueRow = { id: string; facility_id: string; symptom: Symptom; description: string; status: Status; eta_text: string | null; created_at: string; updated_at: string; resolved_at: string | null; affected_count: number; participated: number };
export function issues(where = '1=1', params: SQLInputValue[] = [], clientId = ''): Issue[] {
  return all<IssueRow>(`SELECT i.*, (SELECT COUNT(*) FROM participations p WHERE p.issue_id=i.id) AS affected_count,
    EXISTS(SELECT 1 FROM participations p WHERE p.issue_id=i.id AND p.client_id=?) AS participated
    FROM issues i WHERE ${where}`, clientId, ...params).map(row => ({
    id: row.id, facilityId: row.facility_id, symptom: row.symptom, description: row.description,
    status: row.status, etaText: row.eta_text, createdAt: row.created_at, updatedAt: row.updated_at,
    resolvedAt: row.resolved_at, affectedCount: row.affected_count, hasParticipated: Boolean(row.participated),
  }));
}
export const sortOpen = (a: Issue, b: Issue) => b.affectedCount - a.affectedCount || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
export const sortResolved = (a: Issue, b: Issue) => (b.resolvedAt || '').localeCompare(a.resolvedAt || '') || a.id.localeCompare(b.id);

export function seedData(connection: DatabaseSync, synthetic: boolean) {
  if (connection.prepare('SELECT id FROM facilities LIMIT 1').get()) return;
  const t = midnight();
  const seeds = [
    { id: 'printer-a', name: '프린터 A', location: '도서관 · 1층', kind: 'printer', symptom: 'not_working', description: '출력 버튼을 눌러도 종이가 안 나와요', age: 60, days: [35, 25, 15, 5], weeks: [4, 6, 8, 10], people: 8 },
    { id: 'ac-307', name: '307호 에어컨', location: '학생회관 · 3층', kind: 'air_conditioner', symptom: 'poor_performance', description: '에어컨에서 찬 바람이 안 나와요', age: 60, days: [35, 20, 5], weeks: [2, 2, 2, 2], people: 5 },
    { id: 'water-1f', name: '1층 정수기', location: '학생회관 · 1층', kind: 'water_dispenser', symptom: 'not_working', description: '정수기에서 물이 나오지 않아요', age: 10, days: [5], weeks: [0, 0, 0, 2], people: 2 },
  ];
  connection.exec('BEGIN');
  try {
    connection.prepare('INSERT OR REPLACE INTO app_metadata VALUES (?,?)').run('dataset_kind', synthetic ? 'synthetic' : 'live');
    for (const f of seeds) {
      connection.prepare('INSERT INTO facilities VALUES (?,?,?,?,?,?)').run(f.id, f.name, f.location, f.kind, iso(synthetic ? t - f.age * DAY : Date.now()), iso(Date.now()));
      if (!synthetic) continue;
      const history = f.days.map((day, index) => ({ id: `demo-${f.id}-${index}`, at: t - day * DAY + 3600000, end: index < f.days.length - 1 ? t - f.days[index + 1] * DAY + 3600000 : Infinity }));
      const weekly = [0, 0, 0, 0];
      const client = (n: number) => `demo-${f.id}-person-${n % f.people}`;
      const addReport = (issueId: string, at: number, clientId: string) => {
        const id = randomUUID();
        connection.prepare('INSERT INTO reports VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, issueId, clientId, randomUUID(), `seed-${id}`, f.symptom, f.description, iso(at), 'none', 0);
        connection.prepare('INSERT OR IGNORE INTO participations VALUES (?,?,?)').run(issueId, clientId, iso(at));
        const bucket = Math.floor((at - (t - 28 * DAY)) / (7 * DAY));
        if (bucket >= 0 && bucket < 4) weekly[bucket]++;
      };
      history.forEach((item, index) => {
        const last = index === history.length - 1;
        const status = last ? (f.id === 'ac-307' ? 'acknowledged' : 'reported') : 'resolved';
        connection.prepare('INSERT INTO issues VALUES (?,?,?,?,?,?,?,?,?)').run(item.id, f.id, f.symptom, f.description, status, last && f.id === 'ac-307' ? '오늘 18:00' : null, iso(item.at), iso(last ? item.at : item.end), last ? null : iso(item.end));
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
          const exists = connection.prepare(`SELECT r.id FROM reports r JOIN issues i ON i.id=r.issue_id WHERE i.facility_id=? AND r.client_id=? AND date(r.created_at, '+9 hours')=?`).get(f.id, c, date);
          if (!exists) addReport(item.id, at, c);
        }
      }
      for (let p = 0; p < f.people; p++) connection.prepare('INSERT OR IGNORE INTO participations VALUES (?,?,?)').run(history.at(-1)!.id, client(p), iso(t - DAY));
    }
    connection.exec('COMMIT');
  } catch (error) { connection.exec('ROLLBACK'); throw error; }
}
