'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, ChevronDown, LoaderCircle, MessageCircle, Search, Send, Sparkles } from 'lucide-react';
import { api } from '@/lib/client/api';
import type { AnswerSuggestion, Question, QuestionSubmission } from '@/types/domain';

export default function SubmissionAnswers({ question, admin, refreshKey, onChange }: { question: Question; admin: boolean; refreshKey: number; onChange: () => Promise<void> }) {
  const [items, setItems] = useState<QuestionSubmission[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  useEffect(() => {
    let active = true; setError('');
    api<{ submissions: QuestionSubmission[] }>(`${admin ? 'admin/' : ''}questions/${question.id}`)
      .then(r => { if (active) setItems(r.submissions); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [question.id, question.submissionCount, admin, refreshKey, attempt]);
  const matching = items?.filter(item => (filter === 'all' || (filter === 'pending' ? !item.answerStatus : item.answerStatus === filter)) && `${item.title} ${item.description} ${item.answer || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <section className="submission-list"><div className="section-heading"><div><h3>취합된 요청 <span className="count-tag">{question.submissionCount}</span></h3><p>원문을 펼쳐 각 상황과 개별 답변을 확인하세요.</p></div></div>
    <div className="q-filters"><label className="q-search"><Search size={17} /><input aria-label="취합된 원문 검색" placeholder="원문 내용과 개별 답변 검색" value={search} onChange={e => setSearch(e.target.value)} /></label>{admin && <select aria-label="개별 답변 상태" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">모든 원문 ({items?.length ?? question.submissionCount})</option><option value="pending">개별 검토 대기 ({items?.filter(s => !s.answerStatus).length ?? 0})</option><option value="needs_clarification">추가 확인 요청 ({items?.filter(s => s.answerStatus === 'needs_clarification').length ?? 0})</option><option value="answered">개별 답변 등록 ({items?.filter(s => s.answerStatus === 'answered').length ?? 0})</option></select>}</div>
    {error && <div className="notice" role="alert">{error}<button className="text-button" onClick={() => setAttempt(n => n + 1)}>다시 불러오기</button></div>}
    {!items && !error && <p className="muted">원문을 불러오는 중…</p>}
    {items && matching?.length === 0 && <p className="muted" role="status">조건에 맞는 원문이 없어요. 검색어나 답변 상태를 변경해 주세요.</p>}
    {items?.map((item, index) => <div key={`${item.id}-${item.answerRevision ?? item.answeredAt}`} hidden={!matching?.includes(item)}><SubmissionAnswer question={question} item={item} number={index + 1} admin={admin} onSaved={saved => { setItems(list => list!.map(s => s.id === saved.id ? saved : s)); void onChange(); }} /></div>)}
  </section>;
}

function SubmissionAnswer({ question, item, number, admin, onSaved }: { question: Question; item: QuestionSubmission; number: number; admin: boolean; onSaved: (item: QuestionSubmission) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnswerSuggestion | null>(null);
  const [answer, setAnswer] = useState(item.answer || '');
  const [status, setStatus] = useState<'answered' | 'needs_clarification'>(item.answerStatus || 'needs_clarification');
  const [generating, setGenerating] = useState(false); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [edited, setEdited] = useState(false);
  const [sourceUpdatedAt] = useState(question.updatedAt);
  const base = `admin/questions/${question.id}/submissions/${item.id}`;
  async function recommend() {
    setGenerating(true); setError('');
    try { setDraft((await api<{ suggestion: AnswerSuggestion }>(`${base}/suggestion`, { method: 'POST' })).suggestion); }
    catch (e) { setError(e instanceof Error ? e.message : '추천을 불러오지 못했어요.'); }
    finally { setGenerating(false); }
  }
  async function save(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const r = await api<{ submission: QuestionSubmission }>(base, { method: 'PATCH', body: JSON.stringify({ answer, status, revision: item.answerRevision ?? 0, sourceUpdatedAt: draft?.sourceUpdatedAt || sourceUpdatedAt }) });
      onSaved(r.submission);
    } catch (e) { setError(e instanceof Error ? e.message : '답변을 저장하지 못했어요.'); }
    finally { setSaving(false); }
  }
  const label = item.answerStatus === 'answered' ? '개별 답변 등록' : item.answerStatus === 'needs_clarification' ? '추가 확인 요청' : admin ? '개별 검토 대기' : '답변 대기';
  return <article className="submission-item"><button className="submission-toggle" aria-expanded={open} onClick={() => setOpen(!open)}><span className="submission-number">{String(number).padStart(2, '0')}</span><strong>{item.title}</strong><span className={`submission-status ${item.answerStatus === 'answered' ? 'done' : ''}`}>{label}</span><ChevronDown size={17} className={open ? 'rotated' : ''} /></button>
    {open && <div className="submission-content"><p className="q-body">{item.description}</p><time>{new Date(item.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} 접수</time>
      {item.answer ? <div className={`submission-published ${item.answerStatus === 'needs_clarification' ? 'clarify' : ''}`}><strong>{item.answerStatus === 'answered' ? <Check size={16} /> : <MessageCircle size={16} />}{label}</strong><p>{item.answer}</p><small>담당자 검토 후 게시 · 이 원문에 대한 답변입니다.</small></div> : <p className="submission-pending">아직 등록된 답변이 없어요. 담당자가 확인 후 안내해 드립니다.</p>}
      {admin && <div className="submission-workbench"><div className="submission-ai-heading"><div><strong><Sparkles size={16} />원문별 답변 추천</strong><p>원문과 등록된 공통 안내를 바탕으로 초안을 작성합니다.</p></div><button className="button secondary" onClick={() => void recommend()} disabled={generating || saving}>{generating ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{generating ? '추천 작성 중…' : draft ? '다시 추천' : 'AI 추천 생성'}</button></div>
      {!question.answer && <p className="submission-caution">공통 안내가 없어 담당자가 확인할 근거와 추가 질문을 추천합니다.</p>}
      {draft && <div className="submission-draft"><div className="submission-draft-heading"><span>{draft.mode === 'mock' ? '데모 추천' : 'AI 추천 초안'} · 검토 전</span><b>{draft.status === 'needs_clarification' ? '추가 확인 필요' : '공통 안내 근거 있음'}</b></div><p>{draft.answer}</p><div className="submission-reason"><strong>추천 이유</strong><p>{draft.reason}</p>{draft.missingInfo.length > 0 && <><strong>확인할 정보</strong><ul>{draft.missingInfo.map((info, i) => <li key={i}>{info}</li>)}</ul></>}</div><button className="button secondary" disabled={saving || (edited && Boolean(answer.trim()))} onClick={() => { setAnswer(draft.answer); setStatus(draft.status); setEdited(false); }}>이 초안으로 답변 작성</button>{edited && Boolean(answer.trim()) && <p className="small muted">작성 중인 답변을 유지합니다. 초안을 사용하려면 입력 내용을 먼저 비워 주세요.</p>}</div>}
      <form className="q-answer-form" onSubmit={save}><label>원문에 보낼 답변<textarea required minLength={5} maxLength={5000} rows={5} value={answer} onChange={e => { setAnswer(e.target.value); setEdited(true); }} disabled={saving} placeholder="추천 초안을 가져와 수정하거나 직접 작성하세요." /></label><label>답변 상태<select value={status} onChange={e => setStatus(e.target.value as typeof status)} disabled={saving}><option value="needs_clarification">추가 확인 요청</option><option value="answered">개별 답변 등록</option></select></label><p className="muted small">공개 답변입니다. 개인 식별정보를 넣지 않고, 조건과 안내를 확인한 뒤 게시해 주세요.</p><button className="button primary" disabled={saving || generating || answer.trim().length < 5 || (answer.trim() === item.answer && status === item.answerStatus)}><Send size={16} />{saving ? '게시 중…' : '검토한 개별 답변 게시'}</button></form></div>}
      {error && <div className="notice" role="alert">{error}</div>}
    </div>}
  </article>;
}
