import { db, seedData } from '../src/lib/server/db.ts';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.includes('--demo')) {
  if (!args.includes('--reset')) throw new Error('데모 초기화에는 --reset이 필요합니다. npm run db:seed:demo -- --reset');
  const path = resolve(process.env.SQLITE_PATH || './data/onefix.sqlite');
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
  rmSync(resolve(process.env.UPLOAD_DIR || './data/uploads'), { recursive: true, force: true });
}
const connection = db('none');
if (!args.includes('--init')) seedData(connection, args.includes('--demo'));
console.log(args.includes('--demo') ? '데모 시설과 신고 이력을 준비했습니다.' : '데이터베이스를 준비했습니다.');
connection.close();
