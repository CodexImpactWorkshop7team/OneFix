'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole, LoaderCircle, Wrench } from 'lucide-react';
import { api } from '@/lib/client/api';

export default function LoginForm({ configured }: { configured: boolean }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api('auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }); window.location.assign('/admin'); }
    catch (e) { setError(e instanceof Error ? e.message : '로그인에 실패했어요.'); setBusy(false); }
  }
  return <main className="login-page"><Link className="login-brand" href="/"><Wrench size={24} />onefix.</Link><div className="login-card panel"><div className="login-icon"><LockKeyhole size={26} /></div><div className="eyebrow">ADMIN WORKSPACE</div><h1>관리자 로그인</h1><p>요청을 확인하고, 필요한 답변과 해결을 전하세요.</p><form onSubmit={submit}><fieldset disabled={busy || !configured}><label>관리자 아이디<input name="username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} placeholder="관리자 아이디" maxLength={100} /></label><label>비밀번호<input name="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} maxLength={256} /></label><button className="button primary full" type="submit">{busy ? <LoaderCircle size={17} className="spin" /> : <LockKeyhole size={17} />}{busy ? '로그인 중…' : '관리자 대시보드 열기'}<ArrowRight size={17} /></button></fieldset></form>{!configured && <div className="notice">관리자 계정 설정 후 이용할 수 있습니다.</div>}{error && <div className="notice" role="alert">{error}</div>}<Link className="back-link" href="/"><ArrowLeft size={15} />로그인 없이 요청 등록·조회하기</Link></div><p className="login-footer">요청은 누구나. 관리는 담당자만.</p></main>;
}
