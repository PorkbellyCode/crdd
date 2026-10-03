# crdd-web — Claude Code 작업 규칙

CRDD(Code Recognition Debt Deductor) 웹앱. AI가 만든 코드를 개발자가 얼마나 이해하는지 **부채비율**로 보여준다.
구조와 코드 지도는 `README.md`를 먼저 읽는다.

## 명령

- 패키지 매니저: **bun** (런타임은 node)
- 타입체크: `bun run typecheck`
- 테스트: `bun test`
- 빌드: `bun run build`
- 위 세 가지가 CI와 같다. 작업 완료 전에 반드시 통과시킨다.

## 공통 규칙

- 답변·주석·커밋 메시지는 한국어. 커밋 형식은 `feat(quiz): ...`, `fix(llm): ...` 처럼 `타입(범위): 설명`.
- `git stash` 금지. 작업을 분리해야 하면 git worktree를 쓴다.
- 커밋은 사용자가 확인한 뒤에만 한다.
- `.env*`, `local.db`는 읽거나 수정하지 않는다.
- 자기 담당 범위 밖 파일은 직접 고치지 말고, 담당자에게 메시지로 요청한다.

## 에이전트 팀 구성

리드(메인 세션)가 **설계자**다. 팀원은 `.claude/agents/`에 정의돼 있다.

| 이름 | 정의 | 모델 | 역할 |
|---|---|---|---|
| 리드 | (메인 세션) | Opus | 요구사항 정리, 설계안, 작업 분배, 최종 판단 |
| frontend | `frontend` | Sonnet | 페이지·컴포넌트·클라이언트 훅 |
| backend | `backend` | Sonnet | API 라우트·분석 파이프라인·퀴즈·점수·DB·LLM |
| critic | `critic` | Opus | 설계와 코드의 허점 찾기, 타입체크·테스트·빌드 실행 (코드 수정 안 함) |
| learner | `learner` | Sonnet | 비개발자·학습자 관점에서 화면 문구·퀴즈·설명 평가 (코드 수정 안 함) |

### 작업 유형별 조합 — 매번 전원을 띄우지 않는다

- **기능 설계 논의**: 리드 + critic + learner
- **구현**: 리드 + frontend 및/또는 backend(필요한 쪽만) + critic
- **UX·문구 점검**: 리드 + learner
- **버그 조사**: 리드 + backend/frontend + critic (가설을 서로 반박하게 한다)

### 진행 순서

1. **계획** — 리드가 요구사항을 정리하고 설계안을 1~3개 낸다. 바꿀 파일과 담당자를 명시한다.
2. **검토** — critic(필요하면 learner)이 설계안을 반박한다. 리드는 반박을 반영해 안을 확정한다. 최대 2라운드.
3. **구현** — frontend/backend가 자기 담당 파일만 고친다. 둘이 맞물리는 타입·API 응답 형태는 backend가 먼저 정하고 frontend에 알린다.
4. **검증** — critic이 `bun run typecheck` · `bun test` · `bun run build`를 돌리고 리뷰한다. 실패하면 담당자에게 돌려보낸다.
5. **보고** — 리드가 바뀐 내용, 남은 위험, 커밋 제안 메시지를 사용자에게 요약한다.

리드는 팀원이 끝나기 전에 직접 구현하지 않는다.

## 담당 범위

- **frontend**: `src/app/**/page.tsx`, `src/app/layout.tsx`, `src/app/globals.css`, `src/components/**`, `src/lib/client/**`
- **backend**: `src/app/api/**`, `src/lib/{analysis,crdd,github,llm,quiz}/**`, `src/db/**`, `drizzle/**`, `src/auth.ts`, `src/lib/user*.ts`
- **공유 계약**(backend 소유, 바꾸기 전 frontend에 알림): `src/lib/*/types.ts`, `src/lib/quiz/view.ts`, API 응답 형태
- 범위가 애매하면 리드가 정한다.
