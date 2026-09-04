export const statuses = ['reported', 'acknowledged', 'in_progress', 'resolved'] as const;
export type Status = typeof statuses[number];
export const statusLabels: Record<Status, string> = {
  reported: '접수됨', acknowledged: '확인 완료', in_progress: '처리 중', resolved: '해결됨',
};
export const symptoms = ['not_working', 'poor_performance', 'physical_damage', 'leak_or_noise', 'other'] as const;
export type Symptom = typeof symptoms[number];
export const symptomLabels: Record<Symptom, string> = {
  not_working: '작동 안 됨', poor_performance: '성능 이상', physical_damage: '부품 파손',
  leak_or_noise: '누수 · 소음', other: '기타',
};
export type DedupMethod = 'none' | 'ai' | 'mock' | 'fallback';
export type Facility = { id: string; name: string; location: string; kind: 'printer' | 'air_conditioner' | 'water_dispenser' };
export type Issue = {
  id: string; facilityId: string; symptom: Symptom; description: string; status: Status;
  etaText: string | null; affectedCount: number; hasParticipated: boolean;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
};
export type AdminIssue = Issue & { facility: Facility };
export type Report = {
  id: string; issueId: string; symptom: Symptom; description: string; createdAt: string;
  dedupMethod: DedupMethod; merged: boolean;
  photo: { id: string; url: string; mimeType: string; byteSize: number } | null;
};
export type Meta = { dedupMode?: 'mock' | 'openai'; datasetKind: 'live' | 'synthetic'; features: { photos: boolean; predictions?: boolean } };
export type FacilityList = { facilities: (Facility & { openIssueCount: number; url: string })[]; meta: Meta };
export type FacilityDetail = { facility: Facility; issues: Issue[]; recentlyResolvedIssues: Issue[] };
export type AdminList = { issues: AdminIssue[]; counts: { open: number; inProgress: number; resolved: number } };
export type ReportResult = { reportId: string; issueId: string; merged: boolean; affectedCount: number; dedupMethod?: DedupMethod; noticeCode?: 'MOCK_MODE' | 'DEDUP_UNAVAILABLE' | null };
export type PredictionItem = {
  facility: Facility; observedDays: number; openIssueCount: number;
  forecast: {
    status: 'ready' | 'insufficient_data'; expectedReports7d: number | null;
    weeklyCounts: [number, number, number, number] | null; reportCount28d: number | null;
    reasonCode: 'OK' | 'OBSERVATION_TOO_SHORT' | 'TOO_FEW_REPORTS';
  };
  recurrence: {
    status: 'ready' | 'insufficient_data'; level: 'low' | 'medium' | 'high' | null;
    issueCount30d: number | null; reasonCode: 'OK' | 'OBSERVATION_TOO_SHORT';
  };
};
export type Predictions = { asOf: string; asOfDate: string; generatedAt: string; timezone: 'Asia/Seoul'; methodVersion: 'history-v1'; datasetKind: 'live' | 'synthetic'; items: PredictionItem[] };

export const questionDepartments = ['academic', 'scholarship', 'office'] as const;
export type QuestionDepartment = typeof questionDepartments[number];
export const departmentLabels: Record<QuestionDepartment, string> = {
  academic: '학사 · 수업', scholarship: '장학 · 등록', office: '사무국 · 생활행정',
};
export type Question = {
  id: string; department: QuestionDepartment; period: string; title: string; description: string;
  answer: string | null; answeredAt: string | null; updatedAt: string; createdAt: string;
  interestedCount: number; submissionCount: number; hasParticipated: boolean;
  answeredSubmissionCount?: number; clarificationCount?: number;
};
export type QuestionSubmission = { id: string; title: string; description: string; createdAt: string; dedupMethod?: DedupMethod; answer: string | null; answerStatus: 'answered' | 'needs_clarification' | null; answerRevision?: number; answeredAt: string | null };
export type QuestionResult = { question: Question; merged: boolean; dedupMethod?: DedupMethod };

export type AnswerSuggestion = {
  answer: string; status: 'answered' | 'needs_clarification'; reason: string; missingInfo: string[];
  mode: 'openai' | 'mock'; sourceUpdatedAt: string;
};
