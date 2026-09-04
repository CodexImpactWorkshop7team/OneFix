import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'OneFix — 같은 고장, 하나의 신고', description: '시설 상태 확인부터 신고, 처리 현황과 예방 점검까지.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
