import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'OneFix — 같은 문제, 하나의 해결', description: '설비과 행정 요청을 모아, 처리 현황과 공통 답변을 함께 확인하세요.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
