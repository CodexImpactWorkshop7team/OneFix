'use client';

import Link from 'next/link';
import QuestionsBoard from './questions-board';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, Building2, Camera, Check, CheckCheck, ChevronDown, ChevronRight, CircleAlert, ClipboardList, Clock3, Droplets, LoaderCircle, MapPin, Plus, Printer, QrCode, RefreshCw, ShieldCheck, Snowflake, Sparkles, Users, Wrench, X } from 'lucide-react';
import { api, clientId, makeId, RequestError } from '@/lib/client/api';
import { statuses, statusLabels, symptoms, symptomLabels, type AdminIssue, type AdminList, type Facility, type FacilityDetail, type FacilityList, type Issue, type Predictions, type Report, type ReportResult, type Status, type Symptom } from '@/types/domain';

type View = 'home' | 'facility' | 'report' | 'admin' | 'questions' | 'question-admin' | 'request';
const title = { home: '설비 요청', facility: '설비 상세', report: '설비 요청', admin: '관리자 대시보드', questions: '행정 요청', 'question-admin': '행정 요청 관리', request: '요청 등록' };
const errorMessage = (error: unknown) => error instanceof Error ? error.message : '다시 시도해 주세요.';
const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));

function FacilityIcon({ kind, size = 23 }: { kind: Facility['kind']; size?: number }) {
  const Icon = kind === 'printer' ? Printer : kind === 'air_conditioner' ? Snowflake : Droplets;
  return <Icon size={size} strokeWidth={1.8} />;
}
function Badge({ status }: { status: Status }) { return <span className={`badge status-${status}`}><span className="status-dot" />{statusLabels[status]}</span>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="notice" role="alert"><CircleAlert size={18} /><span>{children}</span></div>; }
function Loading() { return <div className="loading"><LoaderCircle size={24} className="spin" /><span>설비 상태를 불러오고 있어요</span></div>; }

export default function OneFixApp({ view, facilityId }: { view: View; facilityId?: string }) {
  const adminView = view === 'admin' || view === 'question-admin';
  const [authenticated, setAuthenticated] = useState(false);
  const [catalog, setCatalog] = useState<FacilityList | null>(null);
  const [admin, setAdmin] = useState<AdminList | null>(null);
  const [detail, setDetail] = useState<FacilityDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<FacilityList['facilities'][number] | null>(null);
  const [storageWarning, setStorageWarning] = useState(false);
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [generation, setGeneration] = useState(0);
  const refresh = useCallback(async () => {
    setBusy(true); setError('');
    try {
      const [facilities, nextAdmin, nextDetail] = await Promise.all([
        api<FacilityList>(adminView ? 'admin/facilities' : 'facilities'),
        view === 'home' || view === 'admin' ? api<AdminList>(view === 'home' ? 'overview' : `admin/issues?state=${tab}`) : Promise.resolve(null),
        facilityId ? api<FacilityDetail>(`facilities/${facilityId}`) : Promise.resolve(null),
      ]);
      setCatalog(facilities); setAdmin(nextAdmin); setDetail(nextDetail); setGeneration(n => n + 1);
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  }, [view, facilityId, tab, adminView]);
  useEffect(() => { void refresh(); api<{ authenticated: boolean }>('auth/session').then(r => setAuthenticated(r.authenticated)).catch(() => setAuthenticated(false)); }, [refresh]);
  async function logout() {
    try { await api('auth/logout', { method: 'POST' }); window.location.assign('/'); }
    catch (e) { setError(errorMessage(e)); }
  }
  useEffect(() => { const listener = () => setStorageWarning(true); window.addEventListener('onefix-storage-unavailable', listener); return () => window.removeEventListener('onefix-storage-unavailable', listener); }, []);

  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark"><Wrench size={23} strokeWidth={2.5} /></span><span>one<span className="brand-fix">fix</span><span className="brand-period">.</span></span></Link>
      <div className="workspace"><div className="workspace-icon"><Building2 size={19} /></div><div><strong>우리 캠퍼스</strong><span>캠퍼스 소통 워크스페이스</span></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="주 메뉴">
        <Link href="/" className={`nav-item ${['home', 'facility', 'report'].includes(view) ? 'active' : ''}`}><Building2 size={20} />설비 요청<span className="nav-count">{catalog?.facilities.length || 3}</span></Link>
        <Link href="/questions" className={`nav-item ${view === 'questions' ? 'active' : ''}`}><Users size={20} />행정 요청<span className="nav-new">NEW</span></Link>
        <Link href="/requests" className={`nav-item ${view === 'request' ? 'active' : ''}`}><Plus size={20} />새 요청 등록</Link>
        {authenticated && <><Link href="/admin/questions" className={`nav-item ${view === 'question-admin' ? 'active' : ''}`}><CheckCheck size={20} />행정 요청 관리</Link>
        <Link href="/admin" className={`nav-item ${view === 'admin' ? 'active' : ''}`}><ClipboardList size={20} />설비 요청 관리<ChevronRight size={16} className="nav-chevron" /></Link>
        <Link href="/admin#predictions" className="nav-item"><BarChart3 size={20} />예방 점검<span className="nav-new">NEW</span></Link></>}
      </nav>
      <div className="sidebar-tip"><span className="tip-symbol"><QrCode size={25} /></span><strong>설비 앞에서, 바로 확인</strong><p>QR 하나로 설비 요청과<br />처리 현황을 함께 확인해요.</p></div>
      <div className="sidebar-bottom"><span className="avatar">OF</span><div><strong>OneFix</strong><span>함께 해결하는 캠퍼스</span></div><span className="online-dot" /></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span>워크스페이스</span><ChevronRight size={14} /><strong>{title[view]}</strong></div><div className="topbar-right">{authenticated ? <><Link className="text-link" href="/admin">관리자 대시보드</Link><button className="button secondary" onClick={() => void logout()}>로그아웃</button></> : <Link className="button secondary" href="/login">관리자 로그인</Link>}</div></header>
      <main className="main-content">
        {storageWarning && <Notice>이 브라우저에서 사용자 정보를 저장할 수 없어 새로고침 후 중복 참여 방지가 제한될 수 있어요.</Notice>}
        {catalog?.meta.datasetKind === 'synthetic' && <div className="demo-strip"><Sparkles size={14} /><span>시연용 예시가 포함되어 있습니다. 실제 일정과 규정은 담당 부서의 공지를 확인해 주세요.</span></div>}
        {adminView && catalog?.meta.dedupMode === 'mock' && <div className="demo-strip"><Sparkles size={14} /><span>데모 병합 모드 <span className="demo-divider">·</span> 정해진 예시 문장으로 중복 요청을 확인합니다.</span>{catalog.meta.datasetKind === 'synthetic' && <span className="demo-label">샘플 데이터</span>}</div>}
        {error && <Notice>{error} <button className="text-button" onClick={() => void refresh()}>다시 시도</button></Notice>}
        {!catalog && !error ? <Loading /> : null}
        {catalog && view === 'request' && <><div className="page-heading"><div><div className="eyebrow">NEW REQUEST</div><h1>어떤 도움이 필요하세요?</h1><p>로그인 없이 요청을 남기고, 진행 상황과 답변을 확인할 수 있어요.</p></div></div><div className="request-options"><section className="panel request-option"><Wrench size={28} /><h2>설비 요청</h2><p>고장이나 이용 중 불편한 설비을 선택해 주세요.</p>{catalog.facilities.map(f => <Link key={f.id} className="request-facility" href={`/facilities/${f.id}/report`}><span><strong>{f.name}</strong><small>{f.location}</small></span><ArrowRight size={17} /></Link>)}</section><section className="panel request-option"><Users size={28} /><h2>행정 요청</h2><p>학사, 장학금, 신청 절차 등 궁금한 내용을 담당 부서에 물어보세요.</p><Link className="button primary full" href="/questions?new=1">행정 요청 작성<ArrowRight size={17} /></Link><Link className="text-link" href="/questions">이미 올라온 요청과 답변 보기<ArrowRight size={14} /></Link></section></div></>}
        {(view === 'questions'  || view === 'question-admin') && <QuestionsBoard key={view} admin={view === 'question-admin'} />}
        {catalog && view === 'home' && admin && <>
          <div className="page-heading"><div><div className="eyebrow">ONE PLACE, EVERY REQUEST</div><h1>불편도 궁금증도, 한곳에서.</h1><p>설비과 행정 요청을 모아, 해결 상황과 담당자의 답변을 함께 확인하세요.</p></div><button className="button secondary" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''} />새로고침</button></div>
          <Link className="q-home-link" href="/requests"><Plus size={25} /><div><strong>새 요청 등록하기</strong><span>설비 고장 · 이용 불편 · 학사 · 장학 · 생활행정</span></div><ArrowRight size={20} /></Link>
          <div className="stats-grid"><Stat label="등록된 설비" value={catalog.facilities.length} unit="곳" icon={<Building2 />} note="우리 캠퍼스의 공용 설비" /><Stat label="확인이 필요한 고장" value={admin.counts.open} unit="건" icon={<CircleAlert />} note="같은 문제는 하나로 모았어요" accent /><Stat label="처리 중" value={admin.counts.inProgress} unit="건" icon={<Wrench />} note="관리자가 해결하고 있어요" /><Stat label="해결 완료" value={admin.counts.resolved} unit="건" icon={<CheckCheck />} note="다시 편리하게 이용하세요" /></div>
          <div className="section-heading" id="facilities"><div><h2>우리 캠퍼스 설비 <span className="count-tag">{catalog.facilities.length}</span></h2><p>이용 중인 설비을 선택해 주세요.</p></div><span className="sort-caption"><span className="online-dot" />현재 접수 현황</span></div>
          <div className="facility-grid">{catalog.facilities.map(f => {
            const current = admin.issues.filter(i => i.facilityId === f.id); const lead = current[0];
            return <article className="facility-card" key={f.id}><div className="facility-card-top"><div className={`facility-icon kind-${f.kind}`}><FacilityIcon kind={f.kind} size={27} /></div>{lead ? <Badge status={lead.status} /> : <span className="badge status-resolved"><Check size={13} />접수 없음</span>}</div>
              <Link href={`/facilities/${f.id}`} className="facility-title">{f.name}<ArrowUpRight size={21} /></Link><div className="location"><MapPin size={14} />{f.location}</div>
              <div className="facility-current"><span className="small-label">현재 요청</span><strong>{lead ? symptomLabels[lead.symptom] : '현재 접수된 고장이 없습니다'}</strong><p>{lead?.description || '새로운 문제가 있다면 알려 주세요.'}</p></div>
              <div className="facility-impact"><span><Users size={17} />{lead ? <><strong>{lead.affectedCount}명</strong>이 같은 문제를 겪고 있어요</> : '접수된 불편이 없어요'}</span></div>
              <div className="card-actions"><Link className="button card-main" href={`/facilities/${f.id}`}>상태 확인하기<ArrowRight size={17} /></Link>{authenticated && <button className="button icon-button" aria-label={`${f.name} QR 보기`} onClick={() => setQr(f)}><QrCode size={21} /></button>}</div>
            </article>;
          })}</div>
          <div className="bottom-banner"><div className="banner-icon"><CheckCheck size={28} /></div><div><h3>이미 접수된 문제라면, 한 번의 클릭으로.</h3><p>‘나도 겪고 있어요’를 누르면 영향 인원이 늘어나 관리자에게 전달돼요.</p></div><ArrowUpRight size={24} /></div>
          <div className="section-heading"><div><h2>처리 현황</h2><p>현재 접수된 고장의 진행 상황입니다.</p></div>{authenticated && <Link className="text-link" href="/admin">관리자 화면<ArrowRight size={15} /></Link>}</div>
          <div className="overview-table">{admin.issues.length ? admin.issues.slice(0, 5).map(i => <Link key={i.id} href={`/facilities/${i.facilityId}`} className="overview-row"><div className="mini-facility-icon"><FacilityIcon kind={i.facility.kind} size={19} /></div><div className="overview-title"><strong>{i.facility.name}</strong><span>{symptomLabels[i.symptom]}</span></div><Badge status={i.status} /><span className="overview-eta"><Clock3 size={15} />{i.etaText || '예상 처리 미정'}</span><span className="overview-count"><Users size={16} />{i.affectedCount}명</span><ChevronRight size={18} /></Link>) : <div className="empty-state compact"><CheckCheck /><h3>접수된 고장이 없어요</h3></div>}</div>
        </>}

        {catalog && (view === 'facility' || view === 'report') && detail && <>
          <Link className="back-link" href={view === 'report' ? `/facilities/${facilityId}` : '/'}><ArrowLeft size={16} />{view === 'report' ? '설비 상태로 돌아가기' : '전체 설비'}</Link>
          {view === 'facility' ? <>
            <div className="facility-page-heading"><div className={`facility-icon large kind-${detail.facility.kind}`}><FacilityIcon kind={detail.facility.kind} size={32} /></div><div><div className="eyebrow">FACILITY STATUS</div><h1>{detail.facility.name}</h1><div className="location"><MapPin size={15} />{detail.facility.location}</div></div><div className="heading-actions"><button className="button secondary" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} className={busy ? 'spin' : ''} />새로고침</button>{authenticated && <button className="button secondary" onClick={() => setQr(catalog.facilities.find(f => f.id === facilityId)!)}><QrCode size={18} />QR</button>}</div></div>
            <div className="detail-layout"><section><div className="section-heading tight"><h2>현재 접수된 고장 <span className="count-tag">{detail.issues.length}</span></h2></div>
              <div className="issue-stack">{detail.issues.map(issue => <IssueCard key={issue.id} issue={issue} onChange={refresh} />)}</div>
              {!detail.issues.length && <div className="panel empty-state"><div className="success-ring"><Check size={26} /></div><h3>현재 접수된 고장이 없습니다</h3><p>새로운 불편이 있다면 아래에서 알려 주세요.</p><Link className="button primary" href={`/facilities/${facilityId}/report`}><Plus size={18} />설비 요청하기</Link></div>}
              {detail.recentlyResolvedIssues.length > 0 && <><div className="section-heading"><h2>최근 해결 내역</h2></div><div className="panel resolved-list">{detail.recentlyResolvedIssues.map(i => <div key={i.id}><CheckCheck size={19} /><div><strong>{symptomLabels[i.symptom]}</strong><span>{i.description}</span></div><time>{date(i.resolvedAt!)}</time></div>)}</div></>}
            </section><aside className="detail-aside"><div className="report-prompt"><span className="eyebrow">SOMETHING ELSE?</span><h2>다른 문제가<br />있나요?</h2><p>목록에 없는 고장이라면<br />새로운 요청을 남겨 주세요.</p><Link className="button primary" href={`/facilities/${facilityId}/report`}><Plus size={18} />다른 문제 요청</Link></div><div className="aside-note"><Users size={21} /><h3>같은 문제라면 참여해 주세요</h3><p>별도로 요청하지 않아도 돼요. 함께 겪는 사람 수가 관리자에게 전달됩니다.</p></div></aside></div>
          </> : <ReportForm facility={detail.facility} photos={catalog.meta.features.photos} />}
        </>}
        {catalog && view === 'admin' && admin && <>
          <div className="page-heading"><div><div className="eyebrow">MANAGEMENT</div><h1>불편이 큰 곳부터, 하나씩.</h1><p>영향 인원이 많은 고장을 먼저 확인하고 처리 상황을 알려 주세요.</p></div><button className="button secondary" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16} className={busy ? 'spin' : ''} />새로고침</button></div>
          <div className="stats-grid three"><Stat label="미해결 고장" value={admin.counts.open} unit="건" icon={<CircleAlert />} note="확인과 처리가 필요해요" accent /><Stat label="현재 처리 중" value={admin.counts.inProgress} unit="건" icon={<Wrench />} note="처리 진행 상황을 공유해 주세요" /><Stat label="해결한 고장" value={admin.counts.resolved} unit="건" icon={<CheckCheck />} note="해결된 이력도 보관됩니다" /></div>
          <div className="section-heading"><div className="tabs"><button className={tab === 'open' ? 'selected' : ''} onClick={() => setTab('open')}>미해결 <span>{admin.counts.open}</span></button><button className={tab === 'resolved' ? 'selected' : ''} onClick={() => setTab('resolved')}>해결됨 <span>{admin.counts.resolved}</span></button></div><span className="sort-caption"><ArrowDown size={15} />{tab === 'open' ? '영향 인원 순' : '최근 해결 순'}</span></div>
          <div className="admin-issues">{admin.issues.map((issue, index) => <AdminRow key={`${issue.id}-${generation}`} issue={issue} rank={index + 1} onChange={refresh} />)}{!admin.issues.length && <div className="panel empty-state"><CheckCheck size={30} /><h3>{tab === 'open' ? '미해결 고장이 없어요' : '아직 해결된 고장이 없어요'}</h3></div>}</div>
          {catalog.meta.features.predictions && <PredictionSection generation={generation} />}
        </>}
        <footer className="footer"><span><Wrench size={13} /> OneFix <span className="footer-dot">·</span> 같은 문제, 하나의 해결</span><span>함께 만드는 더 편리한 캠퍼스</span></footer>
      </main>
    </div>
    {authenticated && qr && <QRModal facility={qr} close={() => setQr(null)} />}
  </div>;
}

function Stat({ label, value, unit, icon, note, accent = false }: { label: string; value: number; unit: string; icon: React.ReactNode; note: string; accent?: boolean }) {
  return <div className={`stat-card ${accent ? 'stat-accent' : ''}`}><div className="stat-label"><span>{label}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{String(value).padStart(2, '0')}<span>{unit}</span></div><div className="stat-note">{accent && <span className="status-dot" />}{note}</div></div>;
}

function IssueCard({ issue, onChange }: { issue: Issue; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function participate() {
    setBusy(true); setError('');
    try { await api(`issues/${issue.id}/participations`, { method: 'POST', body: JSON.stringify({ clientId: clientId() }) }); await onChange(); }
    catch (e) { setError(errorMessage(e)); if (e instanceof RequestError && e.code === 'ISSUE_RESOLVED') await onChange(); }
    finally { setBusy(false); }
  }
  return <article className="issue-card"><div className="issue-top"><Badge status={issue.status} /><time>{date(issue.createdAt)} 접수</time></div><h2>{symptomLabels[issue.symptom]}</h2><p className="issue-description">{issue.description}</p><div className="impact-box"><span className="impact-avatars"><i /><i /><i /></span><div><strong>{issue.affectedCount}명</strong>이 같은 문제를 겪고 있어요</div></div><div className="issue-progress"><div><ShieldCheck size={18} /><span>{issue.status === 'reported' ? '담당자 확인 대기 중' : '담당자 확인 완료'}</span></div><div><Clock3 size={18} /><span>예상 처리</span><strong>{issue.etaText || '미정'}</strong></div></div>{error && <Notice>{error}</Notice>}<button className={`button full ${issue.hasParticipated ? 'participated' : 'primary'}`} disabled={busy || issue.hasParticipated} onClick={() => void participate()}>{busy ? <LoaderCircle className="spin" size={18} /> : issue.hasParticipated ? <Check size={18} /> : <Users size={18} />}{issue.hasParticipated ? '참여했어요' : busy ? '반영 중…' : '나도 겪고 있어요'}</button></article>;
}

function ReportForm({ facility, photos }: { facility: Facility; photos: boolean }) {
  const [symptom, setSymptom] = useState<Symptom>('not_working'); const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<File | null>(null); const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState<ReportResult | null>(null);
  const requestId = useRef(''); const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!photo) { setPreview(''); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  const edited = () => { requestId.current = ''; setError(''); };
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (description.trim().length < 5) { setError('어떤 문제인지 5자 이상 적어 주세요.'); return; }
    setBusy(true); requestId.current ||= makeId();
    const form = new FormData(); form.set('requestId', requestId.current); form.set('clientId', clientId()); form.set('facilityId', facility.id); form.set('symptom', symptom); form.set('description', description.trim()); if (photo) form.set('photo', photo);
    try { setResult(await api<ReportResult>('reports', { method: 'POST', body: form })); }
    catch (e) { setError(errorMessage(e)); if (e instanceof RequestError && e.code === 'REQUEST_ID_CONFLICT') requestId.current = ''; }
    finally { setBusy(false); }
  }
  if (result) return <div className="success-page panel"><div className="success-ring large"><Check size={38} /></div><span className="eyebrow">REPORT RECEIVED</span><h1>{result.merged ? '같은 설비 요청에 합쳐졌어요.' : '설비 요청이 접수됐어요.'}</h1><p>{facility.name}의 불편을 알려 주셔서 감사합니다.<br />처리 상황은 설비 페이지에서 확인할 수 있어요.</p><div className="success-count"><Users size={24} /><strong>{result.affectedCount}명</strong>이 함께 겪고 있어요</div><Link className="button primary" href={`/facilities/${facility.id}`}>설비 상태로 돌아가기<ArrowRight size={18} /></Link></div>;
  return <div className="report-layout"><div className="report-intro"><div className="eyebrow">NEW REPORT</div><h1>어떤 불편이<br />있으신가요?</h1><p>증상을 알려 주시면 같은 고장인지<br />확인한 후 접수해 드려요.</p><div className="report-facility"><div className={`facility-icon kind-${facility.kind}`}><FacilityIcon kind={facility.kind} /></div><div><strong>{facility.name}</strong><span>{facility.location}</span></div></div><div className="aside-note"><Sparkles size={22} /><h3>같은 요청은 하나로 모여요</h3><p>이미 접수된 고장과 같은 문제라면 기존 요청에 합쳐집니다.</p></div></div><form onSubmit={submit} className="report-form panel"><fieldset disabled={busy}><label className="field-label">어떤 증상인가요?<span>필수</span></label><div className="symptom-options">{symptoms.map(s => <button key={s} type="button" className={symptom === s ? 'selected' : ''} onClick={() => { setSymptom(s); edited(); }}>{symptomLabels[s]}{symptom === s && <Check size={15} />}</button>)}</div><label className="field-label" htmlFor="description">조금 더 자세히 알려 주세요<span>필수</span></label><textarea id="description" value={description} onChange={e => { setDescription(e.target.value); edited(); }} maxLength={500} rows={5} placeholder="예: 출력 버튼을 눌러도 종이가 안 나와요" required /><div className="input-help"><span>문제가 발생하는 상황을 적어 주세요.</span><span>{description.length} / 500</span></div>
      {photos && <><label className="field-label" htmlFor="photo">사진 첨부<span className="optional">선택</span></label><input ref={fileInput} id="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={e => { const f = e.target.files?.[0]; edited(); if (!f) return; if (f.size > 1024 * 1024) { setError('사진은 1MB까지 첨부할 수 있어요.'); e.target.value = ''; return; } setPhoto(f); }} />{preview ? <div className="photo-preview"><img src={preview} alt="첨부할 고장 사진" /><button type="button" className="photo-remove" aria-label="사진 제거" onClick={() => { setPhoto(null); if (fileInput.current) fileInput.current.value = ''; edited(); }}><X size={18} /></button></div> : <button className="upload-zone" type="button" onClick={() => fileInput.current?.click()}><Camera size={26} /><strong>사진을 추가해 주세요</strong><span>JPEG, PNG, WebP · 최대 1MB · 1장</span></button>}</>}
      {error && <Notice>{error}</Notice>}<div className="form-bottom"><p><ShieldCheck size={15} />입력한 요청은 담당자가 확인합니다.</p><button className="button primary full" disabled={busy || description.trim().length < 5} type="submit">{busy ? <><LoaderCircle size={18} className="spin" />기존 요청을 확인하고 있어요…</> : <>요청 등록하기<ArrowRight size={18} /></>}</button></div></fieldset></form></div>;
}

function AdminRow({ issue, rank, onChange }: { issue: AdminIssue; rank: number; onChange: () => Promise<void> }) {
  const [open, setOpen] = useState(false); const [reports, setReports] = useState<Report[] | null>(null);
  const [status, setStatus] = useState<Status>(issue.status); const [eta, setEta] = useState(issue.etaText || ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function toggle() {
    setOpen(!open); if (reports || open) return;
    try { setReports((await api<{ reports: Report[] }>(`admin/issues/${issue.id}`)).reports); }
    catch (e) { setError(errorMessage(e)); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api(`issues/${issue.id}`, { method: 'PATCH', body: JSON.stringify({ status, etaText: eta || null }) }); await onChange(); }
    catch (e) { setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <article className={`admin-row panel ${open ? 'expanded' : ''}`}><button className="admin-row-toggle" onClick={() => void toggle()} aria-expanded={open}><span className="rank">{String(rank).padStart(2, '0')}</span><div className={`facility-icon small kind-${issue.facility.kind}`}><FacilityIcon kind={issue.facility.kind} size={21} /></div><div className="admin-row-title"><strong>{issue.facility.name}</strong><span>{symptomLabels[issue.symptom]}<span className="row-divider">·</span>{issue.facility.location}</span></div><span className="admin-impact"><Users size={17} /><strong>{issue.affectedCount}</strong>명 영향</span><Badge status={issue.status} /><ChevronDown size={20} className={open ? 'rotated' : ''} /></button>
    {open && <div className="admin-row-detail"><div className="admin-history"><h3>접수된 요청 <span className="count-tag">{reports?.length ?? '…'}</span></h3>{!reports && !error && <p className="muted">요청 내용을 불러오는 중…</p>}{reports?.map(r => <div key={r.id} className="report-entry"><div className="report-entry-dot" /><div><p>{r.description}</p><time>{date(r.createdAt)}{r.merged ? ' · 기존 요청에 병합' : ''}</time>{r.photo && <a href={r.photo.url} target="_blank" rel="noreferrer"><img src={r.photo.url} alt="접수된 고장 사진" /></a>}</div></div>)}</div><form className="admin-edit" onSubmit={save}><h3>처리 상황 업데이트</h3><label htmlFor={`status-${issue.id}`}>처리 상태</label><select id={`status-${issue.id}`} value={status} onChange={e => setStatus(e.target.value as Status)} disabled={busy}>{statuses.map(s => <option key={s} value={s} disabled={statuses.indexOf(s) < statuses.indexOf(issue.status)}>{statusLabels[s]}</option>)}</select><label htmlFor={`eta-${issue.id}`}>예상 처리</label><input id={`eta-${issue.id}`} value={eta} maxLength={80} placeholder="예: 오늘 18:00" disabled={busy || status === 'resolved'} onChange={e => setEta(e.target.value)} />{error && <Notice>{error}</Notice>}<button className="button primary full" type="submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}변경 내용 저장</button></form></div>}
  </article>;
}

function PredictionSection({ generation }: { generation: number }) {
  const [data, setData] = useState<Predictions | null>(null); const [error, setError] = useState('');
  useEffect(() => { setError(''); api<Predictions>('admin/predictions').then(setData).catch(e => setError(errorMessage(e))); }, [generation]);
  return <section className="prediction-section" id="predictions"><div className="section-heading"><div><div className="eyebrow"><Sparkles size={13} />PREVENTIVE CARE</div><h2>고장 나기 전에, 한 번 더.</h2><p>요청 이력으로 다음 점검을 준비하세요.</p></div><span className="prediction-source">{data?.datasetKind === 'synthetic' ? '데모 데이터 기반' : '요청 이력 기반'}</span></div>{error ? <Notice>{error}</Notice> : !data ? <Loading /> : <><div className="prediction-grid">{data.items.map(item => {
    const { forecast, recurrence } = item; const level = recurrence.level;
    return <article className="prediction-card" key={item.facility.id}><div className="prediction-card-top"><strong>{item.facility.name}</strong><span className={`risk-badge risk-${level || 'unknown'}`}>{level === 'high' ? '주의도 높음' : level === 'medium' ? '주의도 보통' : level === 'low' ? '주의도 낮음' : '데이터 부족'}</span></div><span className="small-label">다음 7일 예상 요청</span><div className={`forecast-number ${forecast.expectedReports7d === null ? 'unknown' : ''}`}>{forecast.expectedReports7d === null ? '데이터 부족' : <>{forecast.expectedReports7d}<span>건</span></>}</div><div className="mini-chart" aria-label={forecast.weeklyCounts ? `지난 4주 요청: ${forecast.weeklyCounts.join(', ')}건` : '관측기간 부족'}>{(forecast.weeklyCounts || [0, 0, 0, 0]).map((value, i) => <div key={i}><span style={{ height: `${forecast.weeklyCounts ? Math.max(5, value / Math.max(...forecast.weeklyCounts, 1) * 48) : 5}px` }} /><small>{4 - i}주 전</small></div>)}</div><p className="prediction-reason">{forecast.reasonCode === 'OBSERVATION_TOO_SHORT' ? `관측 ${item.observedDays}일 · 28일 이상 필요해요` : forecast.reasonCode === 'TOO_FEW_REPORTS' ? '요청 이력이 더 쌓이면 예상할 수 있어요' : `지난 4주 ${forecast.reportCount28d}건 ÷ 4 = 약 ${forecast.expectedReports7d}건`}</p><div className="recurrence-info"><span>최근 30일 고장 <strong>{recurrence.issueCount30d === null ? '—' : `${recurrence.issueCount30d}건`}</strong></span><span>현재 미해결 <strong>{item.openIssueCount}건</strong></span></div><p className="risk-note">{level === 'high' ? '최근 반복 이력이 있어 예방 점검을 권장해요.' : level === 'medium' ? '반복된 고장 이력을 확인해 주세요.' : level === 'low' ? '최근 반복 이력이 적어요.' : '주의도는 관측 30일 이후 표시됩니다.'}</p></article>;
  })}</div><p className="prediction-footnote"><CircleAlert size={14} />고장 확률이 아닌 이력 기반 참고 지표입니다. {data.asOfDate} 00:00 기준 · 오늘 요청은 내일부터 반영</p></>}</section>;
}

function QRModal({ facility, close }: { facility: FacilityList['facilities'][number]; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const [src, setSrc] = useState(''); const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); import('qrcode').then(qr => qr.toDataURL(facility.url, { width: 300, margin: 2, color: { dark: '#172019', light: '#ffffff' } })).then(setSrc).catch(() => setError('QR을 생성하지 못했어요. 아래 설비 링크로 이동해 주세요.')); }, [facility.url]);
  return <dialog ref={dialog} className="qr-dialog" onCancel={close} onClick={e => { if (e.target === dialog.current) close(); }}><button className="modal-close" onClick={close} aria-label="닫기"><X size={22} /></button><span className="eyebrow">SCAN & CHECK</span><h2>{facility.name}</h2><p>{facility.location}</p>{src ? <img className="qr-image" src={src} alt={`${facility.name} 설비 페이지 QR`} /> : error ? <Notice>{error}</Notice> : <Loading />}<p>QR로 설비 상태와 처리 현황을 확인하세요.</p><Link className="button primary full" href={`/facilities/${facility.id}`} onClick={close}>설비 페이지 열기<ArrowUpRight size={17} /></Link><small>QR을 스캔하면 이 사이트의 설비 페이지로 이동합니다.</small></dialog>;
}
