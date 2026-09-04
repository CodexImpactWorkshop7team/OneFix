<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OneFix 작업 원칙

- 맥북 1대의 같은 작업 폴더에서 기능 단위로 진행한다. 팀원 A/B 역할은 나누지 않는다.
- 사용자는 빠른 MVP 구현을 원한다. 과설계와 불필요한 QA·테스트 추가·반복 검증을 피한다.
- 문서 변경에는 테스트를 실행하지 않는다. 코드 변경은 실제로 영향을 받는 핵심 동작만 최소한으로 확인한다.
- 전체 테스트·타입 검사·lint·build를 관례적으로 묶어 실행하지 않는다. 구체적인 문제를 해결할 때만 필요한 검사를 선택한다.
