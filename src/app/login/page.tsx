import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookie, validSession, authConfigured } from '@/lib/server/auth';
import LoginForm from '@/components/login-form';

export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  if (await validSession((await cookies()).get(sessionCookie)?.value || '')) redirect('/admin');
  return <LoginForm configured={authConfigured()} />;
}
