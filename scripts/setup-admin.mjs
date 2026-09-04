import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs';

const path = '.env.local';
const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
if (/^ADMIN_PASSWORD_HASH=.+/m.test(current) && !process.argv.includes('--reset')) {
  console.log('관리자 계정이 이미 설정되었습니다. 변경하려면 npm run admin:setup -- --reset');
  process.exit(0);
}
const username = 'admin';
const password = randomBytes(18).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const filtered = current.split('\n').filter(line => !/^ADMIN_(USERNAME|PASSWORD_HASH)=/.test(line)).join('\n').trimEnd();
writeFileSync(path, `${filtered}\nADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH=${hash}\n`, { mode: 0o600 });
chmodSync(path, 0o600);
writeFileSync('.admin-credentials.txt', `OneFix 관리자 로그인\n아이디: ${username}\n비밀번호: ${password}\n\n로그인: /login\nVercel에는 .env.local의 ADMIN_USERNAME과 ADMIN_PASSWORD_HASH를 환경 변수로 등록하세요.\n이 파일은 Git에 포함되지 않습니다.\n`, { mode: 0o600 });
chmodSync('.admin-credentials.txt', 0o600);
console.log('관리자 계정을 설정했습니다. 로그인 정보: .admin-credentials.txt (Git 제외)');
