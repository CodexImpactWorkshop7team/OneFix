if (process.env.VERCEL) {
  const missing = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH'].filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Vercel 환경 변수를 등록한 뒤 배포하세요: ${missing.join(', ')}`);
  if (!process.env.TURSO_DATABASE_URL.startsWith('libsql://')) throw new Error('TURSO_DATABASE_URL에는 원격 libsql:// 주소가 필요합니다.');
  if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(process.env.ADMIN_PASSWORD_HASH)) throw new Error('npm run admin:setup으로 관리자 비밀번호 해시를 생성하세요.');
  if (process.env.DEDUP_MODE === 'openai' && (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)) throw new Error('AI 모드에는 OPENAI_API_KEY와 OPENAI_MODEL이 필요합니다.');
}
