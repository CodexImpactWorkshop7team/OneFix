# API 계약 v1

기본 경로 `/api`. 동일 출처의 로컬 데모 API이며 인증은 없다. JSON은 UTF-8, 필드는 camelCase, null은 명시적으로 반환한다. 아래 타입 표기는 응답 구조를 나타내며 실제 구현 파일은 아니다.

## 공통 타입

```typescript
type Status = 'reported' | 'acknowledged' | 'in_progress' | 'resolved';
type Symptom = 'not_working' | 'poor_performance' | 'physical_damage'
  | 'leak_or_noise' | 'other';
type DedupMethod = 'none' | 'ai' | 'mock' | 'fallback';
type Facility = {
  id: string; name: string; location: string;
  kind: 'printer' | 'air_conditioner' | 'water_dispenser';
};
type Issue = {
  id: string; facilityId: string; symptom: Symptom; description: string;
  status: Status; etaText: string | null;
  affectedCount: number; hasParticipated: boolean;
  createdAt: string; updatedAt: string; resolvedAt: string | null;
};
type Photo = { id: string; url: string; mimeType: string; byteSize: number };
type Report = {
  id: string; issueId: string; symptom: Symptom; description: string;
  photo: Photo | null; createdAt: string; dedupMethod: DedupMethod; merged: boolean;
};
```

Issue 응답의 `hasParticipated`는 선택 헤더 `X-OneFix-Client-Id: <UUID>` 기준이다. 헤더가 없으면 false, 형식이 잘못되면 400. 이는 개인화 표시용이며 인증으로 사용하지 않는다. 쓰기 요청의 clientId는 본문을 기준으로 하고, 헤더도 있다면 동일해야 한다.

모든 JSON 조회 응답은 `Cache-Control: no-store`. 시각은 `2026-09-04T01:00:00.000Z` 같은 UTC ISO 형식이다. 목록은 전체 반환하는 데모 범위이며 페이지네이션은 없다. 공통 오류는 아래와 같다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "설명을 5자 이상 입력해 주세요.",
    "field": "description"
  }
}
```

`field`는 해당 없으면 null. 검증 오류는 첫 오류 하나를 반환한다. 미지의 JSON·폼 필드와 중복 폼 필드는 400으로 거절한다. 요청이 지원하는 Content-Type이 아니면 415, 파싱 불가이면 400이다.

## 시설 목록·앱 설정

`GET /api/facilities` → 200

```typescript
{
  facilities: (Facility & { openIssueCount: number; url: string })[];
  meta: {
    dedupMode: 'mock' | 'openai';
    datasetKind: 'live' | 'synthetic';
    features: { photos: boolean; predictions: boolean };
  };
}
```

ID 오름차순. `url`은 APP_BASE_URL에서 생성한 절대 시설 URL이다. 공통 앱 레이아웃이 이 응답으로 데모 표시·기능 플래그를 공유한다. 모델명·키·로컬 파일 경로는 반환하지 않는다.

`GET /api/facilities/:id` → 200 `{ facility: Facility, issues: Issue[], recentlyResolvedIssues: Issue[] }`

issues는 미해결 전체, recentlyResolvedIssues는 최근 해결 최대 3건이다. 정렬은 [제품 명세](product.md)를 따른다. 미해결 없음은 빈 배열이며 오류가 아니다. 시설이 없으면 404 `FACILITY_NOT_FOUND`.

## 참여

`POST /api/issues/:id/participations` · `application/json`

```json
{ "clientId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }
```

200 `{ issueId: string, affectedCount: number, alreadyParticipated: boolean }`

미참여자는 행 1개 추가 후 false, 기존 참여자는 변경 없이 true다. 첫 신고자는 이미 참여자로 등록되어 있다. 상태 확인·삽입·인원 조회는 같은 트랜잭션이다. 고장 없음은 404, 해결된 고장은 기존 참여자라도 409 `ISSUE_RESOLVED`.

## 신고

`POST /api/reports` · `multipart/form-data`

| 필드 | 타입 | 필수 | 규칙 |
| --- | --- | --- | --- |
| `requestId` | UUID 문자열 | 예 | 제출 직전 발급, 네트워크 재시도 시 재사용 |
| `clientId` | UUID 문자열 | 예 | 브라우저 식별자 |
| `facilityId` | 문자열 | 예 | 실제 존재하는 시설 ID |
| `symptom` | Symptom | 예 | enum 값 |
| `description` | 문자열 | 예 | trim 후 5–500자 |
| `photo` | 파일 | 아니오 | P1, 1장, 1–5,242,880바이트, JPEG/PNG/WebP |

파일 확장자·요청 MIME만 믿지 않고 실제 파일 시그니처를 확인한다. multipart 전체 크기는 6MiB로 제한하고 초과는 413이다. 사진 기능이 꺼져 있는데 파일이 있으면 400 `PHOTO_DISABLED`이며 조용히 버리지 않는다.

처음 접수는 새 고장·병합 모두 201, 이미 처리된 동일 요청의 재전송은 200이다.

```json
{
  "reportId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  "issueId": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "merged": true,
  "affectedCount": 9,
  "dedupMethod": "ai",
  "noticeCode": null
}
```

noticeCode는 `null | 'MOCK_MODE' | 'DEDUP_UNAVAILABLE'`. mock 모드에서 판별했다면 MOCK_MODE, fallback이면 DEDUP_UNAVAILABLE, 나머지는 null이다. 후보가 없으면 none이며 전역 mock 표시는 앱 설정으로 유지한다.

동일 requestId·동일 payload의 재전송은 저장된 reportId/issueId/merged/dedupMethod와 **현재** affectedCount를 반환한다. 이후 고장이 해결되어도 같은 접수를 재사용한다. noticeCode는 저장된 dedupMethod에서 유도한다. 동일 ID에 다른 내용은 409 `REQUEST_ID_CONFLICT`. 요청 해시는 [데이터 명세](data-model.md)를 따른다.

AI 오류는 5xx 접수 실패로 반환하지 않고 새 고장을 만들고 fallback을 반환한다. DB·파일 저장 실패는 접수 실패다. 성공 응답 전에 원본 신고와 참여자 저장을 완료해야 한다.

## 관리자 조회·수정

`GET /api/admin/issues?state=open` → 200

state는 `open`(기본) 또는 `resolved`만 허용한다.

```typescript
{
  issues: (Issue & { facility: Facility })[];
  counts: { open: number; inProgress: number; resolved: number };
}
```

counts는 필터에 관계없이 전체 DB 기준이며 inProgress는 open의 부분집합이다. 목록 정렬은 미해결이면 영향 인원 내림차순 → createdAt 오름차순 → id 오름차순, 해결이면 resolvedAt 내림차순 → id 오름차순이다.

`GET /api/admin/issues/:id` → 200 `{ issue: Issue, facility: Facility, reports: Report[] }`

reports는 createdAt 오름차순 → id 오름차순. 사진 URL은 `/api/uploads/{photo.id}`. clientId, payloadHash, requestId, 저장 파일명은 제외한다.

`PATCH /api/issues/:id` · `application/json`

```json
{ "status": "in_progress", "etaText": "오늘 18:00" }
```

두 필드 모두 필수, 200 `{ issue: Issue }`. [상태 전이](product.md)를 검증한다. etaText는 trim 후 최대 80자, 공백·null은 null. resolved일 때는 입력 문구와 관계없이 null로 저장한다. DB의 최신 상태를 트랜잭션 안에서 확인해 역방향 변경은 409 `INVALID_STATUS_TRANSITION`. 같은 상태의 ETA 동시 변경은 마지막 저장을 따른다.

## 사진 조회 · P1

`GET /api/uploads/:id` → 200 바이너리. 서버는 photo ID로 저장 키를 조회한다. 사용자 입력을 파일 경로로 직접 연결하지 않는다. 올바른 Content-Type, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`를 반환한다.

메타데이터·파일 없음은 404 `PHOTO_NOT_FOUND`. 기능 비활성은 404 `FEATURE_DISABLED`. 인증 없는 로컬 데모 API라는 범위는 관리자 상세와 같다.

## 예측 조회 · P1

`GET /api/admin/predictions` → 200. 날짜 입력 파라미터는 받지 않고 서버의 오늘 KST 00:00을 기준으로 한다. 순수 계산 함수만 테스트용 기준일을 주입받는다.

```typescript
{
  asOf: string;                // KST 자정에 해당하는 UTC ISO 시각
  asOfDate: string;            // YYYY-MM-DD, Asia/Seoul
  generatedAt: string;         // 실제 응답 생성 시각
  timezone: 'Asia/Seoul';
  methodVersion: 'history-v1';
  datasetKind: 'live' | 'synthetic';
  items: {
    facility: Facility;
    observedDays: number;      // 완전히 관측된 일수
    openIssueCount: number;    // 현재 응답 생성 시점
    forecast: {
      status: 'ready' | 'insufficient_data';
      expectedReports7d: number | null;
      weeklyCounts: [number, number, number, number] | null;
      reportCount28d: number | null;
      reasonCode: 'OK' | 'OBSERVATION_TOO_SHORT' | 'TOO_FEW_REPORTS';
    };
    recurrence: {
      status: 'ready' | 'insufficient_data';
      level: 'low' | 'medium' | 'high' | null;
      issueCount30d: number | null;
      reasonCode: 'OK' | 'OBSERVATION_TOO_SHORT';
    };
  }[];
}
```

예측 계산·null·정렬의 정확한 규칙은 [prediction.md](prediction.md)다. 데이터 부족은 정상 200이며 해당 항목이 null이다. 기능 꺼짐은 404 FEATURE_DISABLED. 서버 오류는 500이며 화면에서 데이터 부족과 구분한다.

## 오류·재시도 표

| HTTP | code | 클라이언트 동작 |
| --- | --- | --- |
| 400 | VALIDATION_ERROR / PHOTO_DISABLED | 입력 수정 |
| 404 | FACILITY_NOT_FOUND / ISSUE_NOT_FOUND / PHOTO_NOT_FOUND / FEATURE_DISABLED | 목록 이동 또는 기능 숨김 |
| 409 | ISSUE_RESOLVED / INVALID_STATUS_TRANSITION | 최신 상태 재조회 |
| 409 | REQUEST_ID_CONFLICT | 수정된 입력에 새 requestId 발급 |
| 413 | PAYLOAD_TOO_LARGE | 사진 용량 줄이기 |
| 415 | UNSUPPORTED_MEDIA_TYPE | 요청·사진 형식 수정 |
| 503 | SERVER_BUSY | Retry-After: 3, 같은 요청 ID로 사용자가 재시도 |
| 500 | STORAGE_ERROR / INTERNAL_ERROR | 입력 유지·재시도, 서버 상세 오류는 숨김 |

서버 쓰기 트랜잭션이 실패하면 부분 접수를 남기지 않는다. 클라이언트는 네트워크 타임아웃만으로 접수되지 않았다고 단정하지 않고 같은 requestId로 확인·재시도한다.
