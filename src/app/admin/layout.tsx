import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookie, validSession } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await validSession((await cookies()).get(sessionCookie)?.value || '')) redirect('/login');
  return children;
}
