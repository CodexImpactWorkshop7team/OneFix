import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@libsql/client'],
  outputFileTracingExcludes: { '/*': ['./.env*', './.admin-credentials.txt', './data/**/*', './.git/**/*'] },
  outputFileTracingIncludes: { '/*': ['./docs/*schema.sql'] },
};
export default config;
