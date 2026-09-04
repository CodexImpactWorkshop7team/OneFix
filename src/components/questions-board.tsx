'use client';

import Link from 'next/link';
import SubmissionAnswers from './submission-answers';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronDown, MessageCircle, Plus, RefreshCw, Search, Send, Users, X } from 'lucide-react';
import { api, clientId, makeId, RequestError } from '@/lib/client/api';
import { departmentLabels, questionDepartments, type Question, type QuestionDepartment, type QuestionResult } from '@/types/domain';

const message = (e: unknown) => e instanceof Error ? e.message : '다시 시도해 주세요.';
const date = (s: string) => new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });

export default function QuestionsBoard({ admin = false }: { admin?: boolean }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState('all');
  const [status, setStatus] = useState('all');
  const [generation, setGeneration] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState('');
  const [result, setResult] = useState<QuestionResult | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try { setQuestions((await api<{ questions: Question[] }>('questions')).questions); setGeneration(n => n + 1); }
    catch (e) { setError(message(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); setSelected(new URLSearchParams(window.location.search).get('id') || ''); }, [refresh]);
  const filtered = questions.filter(q => (department === 'all' || department === q.department) &&
    (status === 'all' || (status === 'answered' ? Boolean(q.answer) : !q.answer)) &&
    `${q.title} ${q.description} ${q.period} ${q.answer || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const selectedQuestion = questions.find(q => q.id === selected);
  function select(id: string) {
    setSelected(id);
    window.history.replaceState(null, '', `${admin ? '/admin/questions' : '/questions'}${id ? `?id=${encodeURIComponent(id)}` : ''}`);
  }
  return <section className="questions-board">
    <div className="page-heading"><div><div className="eyebrow">ONE QUESTION, SHARED ANSWER</div><h1>{admin ? '같이 모으고, 각각 답해요.' : '같은 궁금증을, 하나로.'}</h1><p>{admin ? '공통 안내를 공유하고, 원문별 상황에 맞는 답변을 검토하세요.' : '학사부터 생활행정까지. 함께 묻고, 담당 부서의 답변을 함께 확인해요.'}</p></div><div className="q-actions"><button className="button secondary" onClick={() => void refresh()} disabled={loading} aria-label="요청 새로고침"><RefreshCw size={17} className={loading ? 'spin' : ''} /></button>{!admin && <button className="button primary" onClick={() => { setForm(!form); setResult(null); }}><Plus size={17} />요청 등록</button>}</div></div>
    <div className="q-summary"><div><strong>{questions.filter(q => !q.answer).length}</strong><span>공통 안내 대기</span></div><div><strong>{questions.filter(q => q.answer).length}</strong><span>공통 안내 등록</span></div><div className="q-summary-note"><MessageCircle size={23} /><span>같은 부서 · 같은 적용 시기<br /><b>원문별 답변으로 세부 상황까지 확인해요</b></span></div></div>
    <div className="q-page-links"><Link className="text-link" href={admin ? '/questions' : '/admin/questions'}>{admin ? '행정 요청 게시판' : '담당자 답변 관리'}<ArrowRight size={15} /></Link>{admin && <Link className="text-link" href="/admin">시설 요청 관리<ArrowRight size={15} /></Link>}</div>
    {form && !admin && <QuestionForm onClose={() => setForm(false)} onResult={async r => { setResult(r); setForm(false); select(r.question.id); await refresh(); }} />}
    {result && <div className="q-result" role="status"><Check size={20} /><div><strong>{result.merged ? '같은 요청에 모였어요.' : '새 요청이 등록됐어요.'}</strong><p>{result.question.answer ? '이미 등록된 공통 안내을 아래에서 확인하세요.' : '답변이 등록되면 이 페이지에서 함께 확인할 수 있어요.'}{result.dedupMethod === 'fallback' && ' AI 중복 확인이 지연되어 별도 요청으로 접수했어요.'}{result.dedupMethod === 'mock' && ' 데모 모드에서는 제목과 내용이 같은 요청만 합칩니다.'}</p></div></div>}
    {error && <div className="notice" role="alert">{error}</div>}
    {selectedQuestion && <div className="q-selected"><div className="section-heading"><h2>선택한 요청</h2><button className="text-button" onClick={() => select('')}>닫기 <X size={15} /></button></div><QuestionCard key={`${selectedQuestion.id}-${selectedQuestion.updatedAt}`} question={selectedQuestion} admin={admin} refreshKey={generation} expanded onChange={refresh} /></div>}
    <div className="q-filters"><label className="q-search"><Search size={17} /><input aria-label="요청 및 답변 검색" placeholder="요청, 답변, 적용 시기 검색" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="담당 부서 필터" value={department} onChange={e => setDepartment(e.target.value)}><option value="all">모든 부서</option>{questionDepartments.map(d => <option key={d} value={d}>{departmentLabels[d]}</option>)}</select></div>
    <div className="section-heading"><div className="tabs">{[['all', '전체'], ['waiting', '공통 안내 대기'], ['answered', '공통 안내 등록']].map(([value, label]) => <button key={value} className={status === value ? 'selected' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div><span className="sort-caption">궁금한 사람 수 ↓</span></div>
    <div className="q-list">{filtered.map((q, i) => <QuestionCard key={`${q.id}-${q.updatedAt}`} question={q} rank={i + 1} admin={admin} refreshKey={generation} onChange={refresh} onSelect={() => select(q.id)} />)}{!loading && !filtered.length && <div className="panel empty-state"><MessageCircle size={32} /><h3>{questions.length ? '조건에 맞는 요청이 없어요' : '첫 번째 궁금증을 알려 주세요'}</h3><p>예: 수강 정정 기간, 장학금 신청 방법, 증명서 발급 안내</p>{!admin && <button className="button primary" onClick={() => setForm(true)}>요청 등록하기<Plus size={17} /></button>}</div>}{loading && !questions.length && <p className="muted">요청을 불러오는 중…</p>}</div>
    <p className="q-footnote">요청 작성자와 ‘나도 궁금해요’ 참여자를 합쳐 요청별 브라우저당 1명으로 집계합니다. 개별 답변은 담당자가 AI 초안을 검토하거나 직접 작성하며, 새로고침으로 최신 답변을 확인할 수 있어요.</p>
  </section>;
}

function QuestionForm({ onClose, onResult }: { onClose: () => void; onResult: (result: QuestionResult) => Promise<void> }) {
  const [department, setDepartment] = useState<QuestionDepartment>('academic');
  const [period, setPeriod] = useState(() => { const now = new Date(); return `${now.getFullYear()}년 ${now.getMonth() < 6 ? 1 : 2}학기`; });
  const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const requestId = useRef('');
  const edited = () => { requestId.current = ''; };
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); requestId.current ||= makeId();
    try {
      const result = await api<QuestionResult>('questions', { method: 'POST', body: JSON.stringify({ requestId: requestId.current, clientId: clientId(), department, period, title, description }) });
      await onResult(result);
    } catch (e) { setError(message(e)); if (e instanceof RequestError && e.code === 'REQUEST_ID_CONFLICT') edited(); }
    finally { setBusy(false); }
  }
  return <form className="panel q-form" onSubmit={submit}><fieldset disabled={busy}><div className="section-heading"><h2>어떤 점이 궁금한가요?</h2><button className="text-button" type="button" onClick={onClose} aria-label="요청 작성 닫기"><X size={20} /></button></div><div className="q-form-columns"><label>담당 부서<select value={department} onChange={e => { setDepartment(e.target.value as QuestionDepartment); edited(); }}>{questionDepartments.map(d => <option key={d} value={d}>{departmentLabels[d]}</option>)}</select></label><label>적용 시기<input required maxLength={40} value={period} onChange={e => { setPeriod(e.target.value); edited(); }} placeholder="예: 2026년 2학기 / 2026년 9월" /></label></div><label>요청 제목<input required minLength={5} maxLength={120} value={title} onChange={e => { setTitle(e.target.value); edited(); }} placeholder="예: 수강 정정은 언제까지 할 수 있나요?" /></label><label>자세한 내용<textarea required minLength={5} maxLength={1500} rows={4} value={description} onChange={e => { setDescription(e.target.value); edited(); }} placeholder="제도 이름과 궁금한 조건을 적어 주세요. 이름, 학번, 연락처 등 개인정보는 넣지 마세요." /></label><div className="input-help"><span>공개 요청입니다. 개인별 심사 결과 등은 담당 부서에 직접 문의해 주세요.</span><span>{description.length}/1500</span></div>{error && <div className="notice" role="alert">{error}</div>}<button className="button primary" type="submit" disabled={busy || title.trim().length < 5 || description.trim().length < 5 || !period.trim()}><Send size={17} />{busy ? '같은 요청을 찾는 중…' : '요청 등록하기'}</button></fieldset></form>;
}

function QuestionCard({ question: q, rank, admin, refreshKey, expanded = false, onChange, onSelect }: { question: Question; rank?: number; admin: boolean; refreshKey: number; expanded?: boolean; onChange: () => Promise<void>; onSelect?: () => void }) {
  const [open, setOpen] = useState(expanded);
  const [answer, setAnswer] = useState(q.answer || '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function participate() {
    setBusy(true); setError('');
    try { await api(`questions/${q.id}/participations`, { method: 'POST', body: JSON.stringify({ clientId: clientId() }) }); await onChange(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await api(`admin/questions/${q.id}`, { method: 'PATCH', body: JSON.stringify({ answer, updatedAt: q.updatedAt }) }); await onChange(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <article className="panel q-card"><div className="q-card-heading">{rank && <span className="rank">{String(rank).padStart(2, '0')}</span>}<div className="q-card-main"><div className="q-meta"><span>{departmentLabels[q.department]}</span><span>{q.period}</span><span className={`badge ${q.answer ? 'status-resolved' : 'status-reported'}`}>{q.answer ? '공통 안내 등록' : '공통 안내 대기'}</span></div><button className="q-title" aria-expanded={open} onClick={() => setOpen(!open)}>{q.title}<ChevronDown size={18} className={open ? 'rotated' : ''} /></button><div className="q-card-counts"><span><Users size={14} />{q.interestedCount}명이 궁금해요</span><button className="text-button" onClick={() => setOpen(!open)}>원문 {q.submissionCount}건 보기<ChevronDown size={13} /></button></div></div>{!admin && <button className={`button ${q.hasParticipated ? 'secondary' : 'primary'} q-vote`} disabled={busy || q.hasParticipated} onClick={() => void participate()}>{q.hasParticipated ? <Check size={16} /> : <Plus size={16} />}{q.hasParticipated ? '함께 궁금해요' : '나도 궁금해요'}</button>}</div>
    {open && <div className="q-detail"><p className="q-body">{q.description}</p><div className="q-detail-meta"><span>{date(q.createdAt)} 접수</span>{onSelect && <button className="text-button" onClick={onSelect}>요청 링크 열기<ArrowRight size={14} /></button>}</div>{q.answer ? <div className="q-answer"><div><Check size={18} /><strong>{departmentLabels[q.department]} 공통 안내</strong></div><p>{q.answer}</p><small>{date(q.answeredAt!)} 업데이트 · 일반 안내입니다. 원문별 적용 여부와 개별 답변은 아래에서 확인하세요.</small></div> : <div className="q-waiting"><MessageCircle size={19} />담당 부서의 답변을 기다리고 있어요.</div>}<SubmissionAnswers question={q} admin={admin} refreshKey={refreshKey} />{admin && <><form className="q-answer-form" onSubmit={save}><label htmlFor={`answer-${q.id}-${rank || 'selected'}`}>{q.answer ? '공통 안내 수정' : '공통 안내 작성'}</label><textarea id={`answer-${q.id}-${rank || 'selected'}`} required minLength={5} maxLength={5000} rows={5} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="관련 규정, 신청 방법, 일정과 참고 링크를 적어 주세요." disabled={busy} /><p className="muted small">저장하면 이 요청을 함께 확인하는 {q.interestedCount}명에게 공통으로 표시됩니다.</p><button className="button primary" disabled={busy || answer.trim().length < 5 || answer.trim() === q.answer}><Send size={16} />{busy ? '저장 중…' : '공통 안내 게시'}</button></form></>}</div>}{error && <div className="notice" role="alert">{error}</div>}</article>;
}
