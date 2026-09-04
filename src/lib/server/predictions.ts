import { all, facilities, datasetKind, midnight, DAY, KST, iso } from './db.ts';
import type { PredictionItem, Predictions } from '../../types/domain.ts';

export async function predictions(): Promise<Predictions> {
  const t = midnight();
  const items: PredictionItem[] = await Promise.all((await facilities()).map(async (facility): Promise<PredictionItem> => {
    const observed = (await all<{ observed_from: string }>('SELECT observed_from FROM facilities WHERE id=?', facility.id))[0].observed_from;
    const firstDay = Math.ceil((new Date(observed).getTime() + KST) / DAY) * DAY - KST;
    const observedDays = Math.max(0, Math.floor((t - firstDay) / DAY));
    const counts = [0, 0, 0, 0] as [number, number, number, number];
    const records = (await all<{ at: string }>(`SELECT MIN(r.created_at) AS at FROM reports r JOIN issues i ON i.id=r.issue_id
      WHERE i.facility_id=? AND r.created_at>=? AND r.created_at<? GROUP BY r.client_id, date(r.created_at, '+9 hours')`, facility.id, iso(t - 28 * DAY), iso(t)));
    for (const record of records) counts[Math.floor((new Date(record.at).getTime() - (t - 28 * DAY)) / (7 * DAY))]++;
    const n = counts.reduce((sum, count) => sum + count, 0);
    const k = (await all<{ n: number }>('SELECT COUNT(*) AS n FROM issues WHERE facility_id=? AND created_at>=? AND created_at<?', facility.id, iso(t - 30 * DAY), iso(t)))[0].n;
    const open = (await all<{ n: number }>("SELECT COUNT(*) AS n FROM issues WHERE facility_id=? AND status<>'resolved'", facility.id))[0].n;
    const enough = observedDays >= 28;
    const ready = enough && (n === 0 || n >= 4);
    return {
      facility, observedDays, openIssueCount: open,
      forecast: { status: ready ? 'ready' : 'insufficient_data', expectedReports7d: ready ? Math.round(n / 4 * 10) / 10 : null,
        weeklyCounts: enough ? counts : null, reportCount28d: enough ? n : null,
        reasonCode: !enough ? 'OBSERVATION_TOO_SHORT' : !ready ? 'TOO_FEW_REPORTS' : 'OK' },
      recurrence: { status: observedDays >= 30 ? 'ready' : 'insufficient_data', level: observedDays < 30 ? null : k >= 3 ? 'high' : k === 2 ? 'medium' : 'low',
        issueCount30d: observedDays >= 30 ? k : null, reasonCode: observedDays >= 30 ? 'OK' : 'OBSERVATION_TOO_SHORT' },
    };
  }));
  const order = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => (a.recurrence.level ? order[a.recurrence.level] : 3) - (b.recurrence.level ? order[b.recurrence.level] : 3)
    || (b.forecast.expectedReports7d ?? -1) - (a.forecast.expectedReports7d ?? -1) || a.facility.id.localeCompare(b.facility.id));
  return { asOf: iso(t), asOfDate: iso(t + KST).slice(0, 10), generatedAt: iso(Date.now()), timezone: 'Asia/Seoul', methodVersion: 'history-v1', datasetKind: (await datasetKind()), items };
}
