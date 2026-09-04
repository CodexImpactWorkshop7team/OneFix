import type { Client, InStatement, InValue } from '@libsql/client';

// Stable IDs and INSERT OR IGNORE preserve real requests and edits on repeat runs.
export async function addDemoData(connection: Client) {
  if ((await connection.execute("SELECT value FROM app_metadata WHERE key='showcase_v1'")).rows.length) return { added: false };
  const statements: InStatement[] = [];
  const insert = (sql: string, ...args: InValue[]) => statements.push({ sql, args });
  const day = 86400000, now = Date.now();
  const at = (days: number) => new Date(now - days * day).toISOString();
  const note = '[시연 예시] ';
  const facilitySeeds = [
    ['lab-printer', '공학관 프린터', '공학관 · 2층', 'printer', 'not_working', '출력 대기열에 문서가 쌓이고 출력이 시작되지 않아요.', 'in_progress', '부품 교체 후 안내 예정', 34],
    ['office-printer', '행정동 복합기', '행정동 · 1층', 'printer', 'poor_performance', '스캔한 문서에 검은 세로줄이 생겨요.', 'acknowledged', '점검 일정 확인 중', 21],
    ['reading-ac', '열람실 에어컨', '도서관 · 3층', 'air_conditioner', 'leak_or_noise', '에어컨을 켜면 진동과 큰 소음이 발생해요.', 'reported', null, 17],
    ['meeting-ac', '회의실 에어컨', '학생회관 · 2층', 'air_conditioner', 'poor_performance', '설정 온도를 낮춰도 실내가 시원해지지 않아요.', 'in_progress', '필터와 냉방 장치 점검 중', 12],
    ['gym-water', '체육관 정수기', '체육관 · 로비', 'water_dispenser', 'not_working', '냉수 버튼을 눌러도 물이 나오지 않아요.', 'acknowledged', '담당 업체 확인 중', 9],
    ['dorm-water', '기숙사 정수기', '기숙사 · 공용 라운지', 'water_dispenser', 'leak_or_noise', '정수기 아래쪽 바닥으로 물이 조금씩 새고 있어요.', 'reported', null, 6],
  ] as const;
  for (const [key, name, location, kind, symptom, description, status, eta, people] of facilitySeeds) {
    const facilityId = `sample-${key}`;
    insert('INSERT OR IGNORE INTO facilities VALUES (?,?,?,?,?,?)', facilityId, `${name} · 예시`, location, kind, at(60), at(60));
    for (let cycle = 0; cycle < 3; cycle++) {
      const id = `sample-showcase-${key}-${cycle}`, age = [24, 12, 2][cycle], active = cycle === 2;
      insert('INSERT OR IGNORE INTO issues VALUES (?,?,?,?,?,?,?,?,?)', id, facilityId, symptom, note + description, active ? status : 'resolved', active ? eta : null, at(age), at(active ? 1 : age - 2), active ? null : at(age - 2));
      for (let person = 0; person < (active ? people : 3); person++) {
        const client = `sample-${key}-person-${person}`;
        insert('INSERT OR IGNORE INTO participations VALUES (?,?,?)', id, client, at(age - 0.1));
        if (person < 3) {
          const reportId = `${id}-report-${person}`;
          insert('INSERT OR IGNORE INTO reports VALUES (?,?,?,?,?,?,?,?,?,?)', reportId, id, client, `${reportId}-request`, `sample-${reportId}`, symptom, note + description + (person ? ' 다른 이용자도 같은 현상을 확인했어요.' : ''), at(age - person * 0.1), 'none', person ? 1 : 0);
        }
      }
    }
  }

  const examples = [
    { key:'course-edit', department:'academic', title:'수강 정정 기간과 변경 방법이 궁금해요', details:'수강 중인 과목을 다른 분반으로 바꾸고 싶어요. 신청 경로를 알려 주세요.', variants:['분반을 바꾸려면 어디에서 신청하나요?', '수강 정정 절차를 한 번에 안내받고 싶어요.'], people:67, answer:'예시 안내입니다. 학사 포털의 수강 정정 메뉴에서 변경 가능한 분반을 확인한 뒤 신청합니다. 실제 정정 기간과 과목별 제한은 소속 학교의 학사 공지를 확인해 주세요.' },
    { key:'scholarship', department:'scholarship', title:'교내 장학금 신청 서류를 알려 주세요', details:'교내 장학금 신청 전에 공통으로 준비할 서류와 제출 경로를 알고 싶어요.', variants:['장학금 신청 서류 목록은 어디에서 볼 수 있나요?', '교내 장학금 제출 서류를 한곳에서 확인하고 싶어요.'], people:54, answer:null },
    { key:'dorm-move', department:'office', title:'기숙사 입사 당일 절차가 궁금해요', details:'입사 당일 방문할 장소와 준비물을 미리 알고 싶어요.', variants:['기숙사 입실할 때 어디부터 가면 되나요?', '입사 당일 준비물과 진행 순서를 알려 주세요.'], people:42, answer:'예시 안내입니다. 입사 공지의 지정 장소에서 본인 확인 후 호실 안내를 받는 흐름입니다. 실제 준비물과 방문 시간은 해당 기숙사 공지를 확인해 주세요.' },
    { key:'tuition-installment', department:'scholarship', title:'등록금 분할 납부 신청은 어떻게 하나요?', details:'등록금 분할 납부 신청 경로와 확인할 조건을 알고 싶어요.', variants:['등록금 분납 신청 메뉴를 찾고 있어요.', '분할 납부 절차와 공지 위치를 안내해 주세요.'], people:36, answer:'예시 안내입니다. 등록 관련 공지에서 분할 납부 대상과 신청 기간을 확인한 뒤 포털에서 신청하는 방식입니다. 개인별 가능 여부와 회차는 담당 부서 확인이 필요합니다.' },
    { key:'course-waitlist', department:'academic', title:'수강 대기 신청 후 순번은 어디서 확인하나요?', details:'대기 신청이 정상 접수됐는지와 순번 확인 경로가 궁금해요.', variants:['수강 대기 목록에 들어갔는지 확인하고 싶어요.', '과목별 수강 대기 순번은 어디에 표시되나요?'], people:31, answer:null },
    { key:'room-booking', department:'office', title:'동아리 모임 공간 예약 방법을 알려 주세요', details:'동아리 모임을 위한 공용 공간 예약 절차가 궁금해요.', variants:['동아리방 외 공용 회의실은 어디서 예약하나요?', '동아리 모임 공간 신청 메뉴를 안내해 주세요.'], people:28, answer:'예시 안내입니다. 공간 예약 시스템에서 사용 목적과 시간을 입력하고 담당자 승인 여부를 확인하는 방식입니다. 실제 이용 조건은 시설별 안내를 확인해 주세요.' },
    { key:'certificate', department:'academic', title:'재학증명서를 온라인으로 발급받고 싶어요', details:'방문하지 않고 재학증명서를 받는 경로와 파일 발급 가능 여부를 알려 주세요.', variants:['온라인 재학증명서 발급 메뉴가 궁금해요.', '재학증명서를 비대면으로 받을 수 있는지 안내해 주세요.'], people:24, answer:'예시 안내입니다. 학교 포털의 증명서 발급 메뉴에서 문서 종류를 선택합니다. 지원 파일 형식과 수수료는 실제 발급 화면에서 확인해 주세요.' },
    { key:'lost-property', department:'office', title:'분실물 보관 장소와 조회 방법이 궁금해요', details:'캠퍼스에서 습득된 분실물을 어디서 조회하고 찾을 수 있나요?', variants:['캠퍼스 분실물은 어느 부서에 모이나요?', '습득물 목록 확인과 수령 절차를 알려 주세요.'], people:22, answer:null },
    { key:'leave-return', department:'academic', title:'복학 신청 전에 확인할 절차를 알려 주세요', details:'복학 신청 메뉴와 공통 준비 절차를 알고 싶어요.', variants:['복학 신청을 위한 공지와 메뉴 위치가 궁금해요.', '복학 신청의 일반적인 순서를 안내해 주세요.'], people:19, answer:'예시 안내입니다. 학적 메뉴에서 복학 신청 항목을 확인하고 해당 학기 공지에 따라 접수합니다. 휴학 유형에 따른 개별 조건은 학사 담당 부서 확인이 필요합니다.' },
    { key:'refund', department:'scholarship', title:'등록금 반환 신청 절차가 궁금해요', details:'반환 신청 경로와 담당 부서 안내를 받고 싶어요.', variants:['등록금 반환 신청서는 어디에 제출하나요?', '등록금 반환 접수 절차와 공지 위치를 알려 주세요.'], people:17, answer:null },
    { key:'library-hours', department:'office', title:'시험 기간 열람실 운영 시간은 어디서 확인하나요?', details:'시험 기간에 달라지는 열람실 이용 시간의 공지 위치를 알고 싶어요.', variants:['시험 기간 열람실 연장 운영 공지는 어디에 있나요?', '열람실 운영 시간 변경 안내를 찾고 있어요.'], people:15, answer:'예시 안내입니다. 도서관 공지에서 열람실별 운영 시간을 확인해 주세요. 운영 시간은 공간과 기간에 따라 달라질 수 있어 이 예시에서 특정 시간을 확정하지 않습니다.' },
    { key:'attendance', department:'academic', title:'출석 인정 신청 방법과 증빙 기준이 궁금해요', details:'출석 인정 신청 메뉴와 증빙 기준을 확인할 곳을 알려 주세요.', variants:['공결 신청은 어떤 메뉴에서 하나요?', '출석 인정 관련 서류 기준을 어디에서 확인하나요?'], people:13, answer:null },
    { key:'student-id', department:'office', title:'학생증 재발급 신청 방법을 알려 주세요', details:'학생증을 재발급받는 일반 절차와 수령 안내가 궁금해요.', variants:['학생증 재발급 메뉴를 찾고 있어요.', '학생증 재발급 신청부터 수령까지 절차를 알려 주세요.'], people:11, answer:'예시 안내입니다. 학생증 담당 부서의 재발급 공지를 확인한 뒤 신청합니다. 분실 카드의 이용 정지, 발급 비용, 수령 장소는 실제 안내에 따라 확인해 주세요.' },
    { key:'work-study', department:'scholarship', title:'교내 근로장학생 모집 공지를 어디서 보나요?', details:'근로장학생 모집 목록과 신청 경로를 한곳에서 확인하고 싶어요.', variants:['교내 근로 모집 목록을 찾고 있어요.', '근로장학생 모집 공지와 지원 메뉴를 알려 주세요.'], people:9, answer:null },
    { key:'parking', department:'office', title:'캠퍼스 방문 차량 등록 절차가 궁금해요', details:'방문 차량의 사전 등록 여부와 일반 신청 절차를 알고 싶어요.', variants:['방문 차량 등록은 어느 부서에서 하나요?', '캠퍼스 방문 주차 등록 방법을 알려 주세요.'], people:7, answer:null },
    { key:'ambiguous', department:'scholarship', title:'저도 신청할 수 있는지 모르겠어요', details:'공지에 조건이 여러 가지 적혀 있어서 제가 해당하는지 모르겠어요. 어떤 정보를 더 확인해야 하나요?', variants:[], people:4, answer:null },
  ];
  for (let index = 0; index < examples.length; index++) {
    const q = examples[index], id = `sample-showcase-question-${q.key}`, created = at(7 - index * 0.35);
    insert('INSERT OR IGNORE INTO questions VALUES (?,?,?,?,?,?,?,?,?)', id, q.department, '워크샵 시연 · 예시 학기', note + q.title, note + q.details, q.answer, q.answer ? at(0.5) : null, created, q.answer ? at(0.5) : created);
    const originals = [q.details, ...q.variants];
    for (let n = 0; n < originals.length; n++) {
      const submissionId = `${id}-original-${n}`;
      insert('INSERT OR IGNORE INTO question_submissions VALUES (?,?,?,?,?,?,?,?,?)', submissionId, id, `${submissionId}-request`, `sample-${submissionId}`, note + (n ? q.variants[n - 1] : q.title), note + originals[n], 'none', n ? 1 : 0, created);
      if (q.answer && n === 0) insert('INSERT OR IGNORE INTO question_submission_answers VALUES (?,?,?,?,?)', submissionId, q.answer, 'answered', 1, at(0.5));
      if ((q.key === 'tuition-installment' && n === 1) || q.key === 'ambiguous') insert('INSERT OR IGNORE INTO question_submission_answers VALUES (?,?,?,?,?)', submissionId, '시연용 추가 확인 요청입니다. 신청하려는 제도의 정확한 이름과 궁금한 조건을 먼저 확인해 주세요. 개인정보나 개인별 심사 자료는 공개 게시판에 올리지 않고 담당 부서의 비공개 경로로 확인합니다.', 'needs_clarification', 1, at(0.3));
    }
    for (let person = 0; person < q.people; person++) insert('INSERT OR IGNORE INTO question_participations VALUES (?,?,?)', id, `sample-showcase-person-${person}`, at(0.2 + person * 0.003));
  }
  insert("INSERT OR REPLACE INTO app_metadata VALUES ('dataset_kind','synthetic')");
  insert("INSERT OR IGNORE INTO app_metadata VALUES ('showcase_v1',?)", at(0));
  await connection.batch(statements, 'write');
  return { added: true, facilities: 6, issues: 18, questions: examples.length, originals: examples.reduce((n, q) => n + 1 + q.variants.length, 0) };
}
