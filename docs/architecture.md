# 개발 환경·구조

이 문서는 구현 계약이다. 명령·파일은 앱 초기화 후 마련해야 하며 아직 존재한다고 가정하지 않는다.

## 기술 결정

| 영역 | 결정 | 이유 |
| --- | --- | --- |
| 앱 | Next.js App Router, TypeScript strict, Tailwind CSS | 화면과 API를 한 프로젝트에서 구현 |
| API | Route Handler, Node.js 런타임, 동일 출처 호출 | 별도 서버·CORS 구성 생략 |
| 저장소 | SQLite + `better-sqlite3`, 직접 SQL | 작은 단일 프로세스 데모, ORM 설정 생략 |
| 검증 | Zod 등 단일 검증 모듈로 서버 입력 검사 | 폼과 서버의 규칙 차이 축소 |
| AI | OpenAI 공식 JS SDK, Responses API, 구조화 출력 | 제한된 ID/null 결과만 사용 |
| 예측 | 서버의 순수 집계 함수 | 외부 호출·학습 없이 재현 가능한 결과 |
| QR | URL에서 생성하는 QR 라이브러리 | 외부 QR 서비스 불필요 |
| 테스트 | Vitest로 도메인 규칙·DB 통합 검증 | UI 스냅샷보다 병합·인원·예측 경계 검증 |

한 맥북의 작업 폴더에서 실행 가능한 라이브러리 조합을 설치한 뒤 `package-lock.json`과 Node 버전 파일 `.nvmrc`에 고정한다. 패키지 관리자는 npm으로 통일하고 재설치 시 `npm ci`를 사용한다. 설치된 Next.js·SQLite 드라이버가 선택한 Node 버전을 지원하는지 최초 실행에서 확인한다.

## 목표 폴더

```text
src/
  app/
    page.tsx
    facilities/[id]/page.tsx
    facilities/[id]/report/page.tsx
    admin/page.tsx
    api/                         # api.md의 모든 HTTP 경로
  components/                    # 카드, 상태 배지, 폼, 예측 카드
  types/domain.ts                # API DTO, 상태·증상 enum
  lib/client/                    # 익명 ID, fetch 래퍼
  lib/server/
    db.ts                        # 연결, 스키마, 트랜잭션
    reports.ts                   # 신고·참여 서비스와 시설별 직렬화
    deduplication.ts             # AI 어댑터, mock, fallback
    predictions.ts               # 기준일을 인자로 받는 순수 계산
    uploads.ts                   # 검증·파일 저장·조회
    validation.ts                # 서버 입력 검증
scripts/                         # DB 초기화·시드
tests/                           # 규칙·DB 테스트
data/                            # git 제외: DB, 업로드
docs/                            # 현재 스펙
```

DB·파일·API 키를 다루는 코드는 서버 전용으로 제한한다. 사진은 `public/`에 넣지 않고 `/api/uploads/:id`로 전달한다. 목록 조회와 변경 후 재조회는 캐시하지 않는다.

## 환경 변수

| 이름 | 예시·기본값 | 규칙 |
| --- | --- | --- |
| `APP_BASE_URL` | `http://localhost:3000` | QR용, 휴대폰 테스트 시 LAN 주소 |
| `SQLITE_PATH` | `./data/onefix.sqlite` | 파일 시스템 경로, 서버 시작 시 상위 폴더 생성 |
| `UPLOAD_DIR` | `./data/uploads` | 업로드 원본 이름을 경로로 사용하지 않음 |
| `DEDUP_MODE` | `mock` 또는 `openai` | 기본 mock, 모드를 화면에 명시 |
| `OPENAI_API_KEY` | 빈 값 | openai 모드일 때만 필요, 커밋 금지 |
| `OPENAI_MODEL` | 빈 값 | 초기화 때 계정에서 사용 가능한 구조화 출력 지원 모델을 정해 기록 |
| `AI_TIMEOUT_MS` | `8000` | AI 1회 호출 제한, SDK 자동 재시도 끔 |
| `FEATURE_PHOTOS` | `false` | P1 사진 구현 완료 후 true |
| `FEATURE_PREDICTIONS` | `false` | P1 예측 구현 완료 후 true |

시작 시 openai 모드인데 키·모델이 없으면 설정 오류를 명확히 안내한다. mock으로 몰래 바꾸지 않는다. 키는 서버 환경에만 읽고 어떤 `NEXT_PUBLIC_*` 변수에도 넣지 않는다. 응답·로그에 키나 신고 원문·사진을 출력하지 않는다.

`.env.example`에는 이름·빈 비밀값만 커밋한다. `.env*`(예시 제외), `data/`, `.next/`, `node_modules/`, 테스트 임시 파일은 `.gitignore`에 둔다. 파일 기반 저장이므로 이 구성으로 서버리스 배포를 가정하지 않는다.

## 실행 명령 계약

| 명령 | 구현할 동작 |
| --- | --- |
| `npm ci` | 저장소의 lockfile 기반 설치 |
| `npm run db:init` | 없는 DB에 스키마 생성, 기존 데이터는 삭제하지 않음 |
| `npm run db:seed` | 고정 시설 3개만 없는 경우 추가, 기존 이력 유지 |
| `npm run db:seed:demo -- --reset` | 명시적 reset 옵션으로 로컬 DB·업로드 초기화, 합성 이력 생성 |
| `npm run dev` | 한 맥북에서 사용할 개발·시연 서버 |
| `npm run dev -- --hostname 0.0.0.0` | 선택: 같은 Wi-Fi의 별도 기기에서 QR 접속 검증 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | 프로젝트의 ESLint CLI 실행 |
| `npm test` | 도메인 규칙·DB·예측 테스트, 실제 AI 호출 제외 |
| `npm run build` | 프로덕션 빌드 검증 |

실행 순서: 환경 변수 설정 → DB 초기화·시드 → dev 실행 → 같은 맥북의 두 브라우저 프로필로 접속 확인. 별도 휴대폰이 있으면 같은 Wi-Fi에서 QR 접속도 확인한다. 데모 초기화는 개발 서버를 중지하고 수행한다.

## 쓰기와 동시성

워크샵은 **Node 서버 한 프로세스**만 실행한다. 여러 인스턴스·프로세스 배포는 범위 밖이다.

1. 서버가 시설별 mutex로 신고 처리를 직렬화한다. 대기열은 시설당 최대 5개, 초과는 503이다.
2. 잠금을 얻은 뒤 `requestId` 재전송 여부와 최신 병합 후보를 확인한다.
3. AI 호출 중 SQLite 쓰기 트랜잭션을 열어 두지 않는다.
4. AI 결과를 받고 짧은 트랜잭션 안에서 대상이 여전히 미해결인지 확인한다. 그사이 해결됐으면 새 고장을 만든다.
5. 고장 생성/연결, 원본 신고, 사진 메타데이터, 참여자 추가를 한 트랜잭션에서 커밋한다.
6. 성공·실패 모두 finally에서 mutex를 해제한다. 참여 API는 DB 유일 제약과 트랜잭션으로 중복을 막는다.

mutex는 개발 핫리로드 중 중복 인스턴스가 생기지 않게 서버 전역 모듈에서 공유한다. DB 연결마다 외래키를 켜고, 트랜잭션은 짧게 유지한다. SQLite busy timeout은 3초이며 실패하면 재시도 가능한 503을 반환한다.

파일은 검증 후 임시 저장, 트랜잭션 직전에 최종 경로로 이동한다. DB 커밋 실패 시 해당 파일을 지우며, 프로세스 중단으로 생긴 미참조 파일은 데모 초기화로 정리한다. 앱이 없는 파일을 성공적으로 첨부했다고 응답하지 않는다.

## 성능·관측 목표

시설 3개·고장 100개·신고 1,000개 수준의 로컬 데모에서 조회·참여는 보통 1초 이내, 대기 없는 AI 신고는 10초 이내 접수를 목표로 한다. 보장된 SLA가 아니다. 클라이언트 신고 타임아웃은 대기열을 고려해 60초로 두고 같은 요청 ID로 재시도한다.

로그는 요청 ID, 처리 시간, 결과 모드, 새 고장/병합 여부, 오류 코드만 기록한다. 공개 운영 전에는 관리자 인증·권한, 요청 제한, 파일 저장·보존 정책, 여러 서버의 동시성 설계를 추가해야 한다.
