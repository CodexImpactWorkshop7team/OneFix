# Vercel 배포

## 웹 구성

- `/`: 공개 요청 센터. 시설 상태와 행정 요청으로 이동한다.
- `/requests`: 시설 요청 / 행정 요청을 선택하여 등록한다. 방문자 로그인은 필요 없다.
- `/questions`: 행정 요청·취합 원문·공통 안내·게시된 개별 답변을 조회한다.
- `/login`: 관리자 로그인.
- `/admin`, `/admin/questions`: 로그인 후 요청 처리·공통 안내·AI 답변 추천을 관리한다.

관리자 화면은 서버 레이아웃에서 세션을 확인한다. `/api/admin/*`, 모든 PATCH API도 서버에서 권한을 검사한다. 메뉴 숨김만으로 보호하지 않는다. 공개 시설 요약은 `/api/overview`로 분리했다.

관리자는 한 계정으로 시작한다. 비밀번호는 scrypt 해시만 환경 변수에 저장하고, 로그인 세션은 무작위 토큰의 해시를 DB에 보관한다. HttpOnly/SameSite=Lax 쿠키와 8시간 만료를 사용한다. Vercel에서는 Secure 쿠키를 사용한다. 로그아웃과 계정 변경 시 기존 세션이 무효화된다. IP별 15분에 10회 로그인 제한을 DB에 저장하여 서버 인스턴스 간 공유한다. 회원가입·일반 사용자 계정·비밀번호 찾기는 이번 범위에서 제외한다.

## 1. 관리자 계정 준비

```sh
npm ci
npm run admin:setup
```

`.admin-credentials.txt`에 임의 생성된 로그인 아이디와 비밀번호가 저장된다. `.env.local`에는 `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`가 기록된다. 두 파일 모두 Git에 포함되지 않는다. 비밀번호를 다시 만들려면 `npm run admin:setup -- --reset`을 실행한 뒤 변경된 환경 변수를 Vercel에도 반영한다.

## 2. Turso DB 준비

[Turso 대시보드](https://app.turso.tech/)에서 **libSQL 데이터베이스**를 만들고 URL과 인증 토큰을 준비한다. URL 형식은 `libsql://…turso.io`다. 기존 SQLite와 호환되는 libSQL을 사용하며, 새 Turso 엔진 DB와 혼동하지 않는다.

로컬에서는 URL을 비워두면 기존 SQLite 파일을 계속 쓴다. Vercel은 로컬 파일을 영구 DB로 사용할 수 없으므로 원격 URL과 토큰이 필수다. 테이블은 최초 서버 접근 때 비파괴 방식으로 추가된다. 새 원격 DB에는 기본 시설 3개만 등록하고, 가짜 신고나 답변은 넣지 않는다. 기존 맥북 데이터는 자동 업로드하지 않는다.

이전에 쌓인 SQLite 데이터를 옮기려면 먼저 별도 백업하고 Turso의 SQLite 가져오기 절차를 사용한다. 기존 파일 사진까지 옮기는 작업은 별도다. 새 사진은 1MB까지 DB BLOB으로 저장하므로 서버가 재시작되어도 유지된다. 현재는 워크샵 규모를 위한 단순 저장 방식이며 대량 사진에는 별도 객체 저장소가 적합하다.

## 3. Vercel 프로젝트 가져오기

[Vercel 새 프로젝트](https://vercel.com/new)에서 `CodexImpactWorkshop7team/OneFix`를 Import한다.

- Framework: Next.js
- Root Directory: 저장소 루트
- Node.js: 22.x (`package.json`에 지정됨)
- Build Command: `npm run build`
- Install Command: `npm ci`
- Output Directory: 기본값 유지

아래 변수를 **Production**에 등록한다. Preview 배포에는 별도 테스트 DB와 관리자 계정을 권장한다.

| 변수 | 값 |
|---|---|
| `TURSO_DATABASE_URL` | 생성한 원격 libSQL DB URL |
| `TURSO_AUTH_TOKEN` | DB 인증 토큰 |
| `ADMIN_USERNAME` | `.env.local`의 값 |
| `ADMIN_PASSWORD_HASH` | `.env.local`의 scrypt 해시 전체 |
| `DEDUP_MODE` | 실제 AI는 `openai`, 시연 규칙은 `mock` |
| `OPENAI_API_KEY` | `openai` 모드일 때 API 키 |
| `OPENAI_MODEL` | `gpt-4.1-mini` |
| `APP_BASE_URL` | 선택. 실제 배포 도메인. 비워두면 현재 호스트 사용 |

API 키, DB 토큰, 비밀번호 해시에 `NEXT_PUBLIC_` 접두사를 붙이지 않는다. 로컬의 `APP_BASE_URL=http://localhost:3000`을 배포 환경에 복사하지 않는다. 필요한 환경 변수가 없으면 빌드가 명확한 오류로 중단된다.

Deploy 후 배포 URL에서 요청을 등록하고 `/login`으로 관리한다. 이후 main 브랜치 push 시 Vercel의 Git 연동으로 재배포할 수 있다.

## 배포 구조 및 제한

Next.js Node 함수 → `@libsql/client` → Turso libSQL. SQL과 예측 로직은 유지하고 DB 접근을 비동기로 전환했다. 사진과 요청은 같은 DB 트랜잭션에 저장한다. 중복 판별은 공유 DB의 90초 임대 잠금으로 여러 Vercel 인스턴스의 동시 접수를 제한한다. AI 호출은 DB 쓰기 트랜잭션 밖에서 수행한다. 사진 1MB 제한으로 Vercel 함수 본문 한도 안에서 전송한다.

현재 방문자 참여는 브라우저 식별자 기반이므로 실제 사람 수 인증은 아니다. 행정 원문과 개별 답변은 공개이며 민감정보를 입력하지 않도록 안내한다. 로그인 제한 외 공개 접수의 운영용 스팸 방지는 별도 기능이다.

이번 변경은 배포 가능한 코드·환경 변수 가이드까지 제공한다. 실제 원격 DB 생성, Vercel 환경 변수 등록 및 배포 성공 여부는 별도로 확인해야 한다.
