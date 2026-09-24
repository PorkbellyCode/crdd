# crdd-web

CRDD(Code Recognition Debt Deductor)의 웹앱. AI가 만든 코드를 개발자가 얼마나 이해하고 있는지 프로젝트 구조 위에 **부채비율**로 보여준다.

## 구조 — 컨테이너 하나에 Node + Python

Graphify는 Python CLI다. 라이브러리로 import하는 게 아니라 **명령어 하나를 자식 프로세스로 실행**할 뿐이라, 서비스를 둘로 쪼개지 않고 한 이미지에 Node와 Python을 같이 넣는다(`Dockerfile`). 그래서 배포 대상은 Vercel이 아니라 Fly.io·Railway 같은 컨테이너 호스팅이다.

```
브라우저 → Next.js (앱 · API · UI)
              └─ 자식 프로세스 → git clone --depth 1
              └─ 자식 프로세스 → graphify extract --code-only
```

## 로컬 실행

필요한 것: [bun](https://bun.com), `git`, 그리고 PATH에 `graphify`.

```bash
brew install oven-sh/bun/bun   # 없으면
uv tool install graphifyy      # 없으면
bun install
bun dev                        # http://localhost:3000
```

패키지 매니저는 bun, 런타임은 node다. 이 프로젝트에서 잰 설치 시간은 콜드 캐시
2.2초(npm은 캐시가 있어도 9.8초), 캐시가 있으면 0.2초. 런타임을 node로 두는 건
Next standalone 서버와 자식 프로세스(git·graphify) 실행이 가장 검증된 조합이라서다.

- `/` — 레포 주소를 넣으면 분석이 시작된다
- `/a/[id]` — 진행 상태 → 완료 시 Understanding Map. 개념을 골라 퀴즈를 시작한다
- `/quiz/[id]` — 퀴즈 3문항 순차 풀이 → 부채비율 반영
- `/settings` — Anthropic API 키(BYOK)와 모델 선택
- `/me` — 내 프로젝트 (로그인 필요)
- `/demo` — porklog 그래프 + **예시** 부채비율

Docker로 돌리려면:

```bash
docker build -t crdd-web .
docker run -p 3000:3000 crdd-web
```

## 실측 (porklog, 컨테이너 기준)

레포 주소 입력부터 지도까지 **3.5초**.

| 단계 | 시간 |
|---|---|
| clone (`--depth 1`) | 1.0s |
| graphify extract + cluster | 2.2s |
| concept 이름 + 레이아웃 | 0.3s |

결과: 413 노드 · 857 엣지 · **concept 13개**, 파일 해시 164개 기록, LLM 호출 0회.

## 코드 지도

| 경로 | 내용 |
|---|---|
| `src/lib/analysis/analyze.ts` | 파이프라인 — clone → 해시 스냅샷 → graphify → concept → 레이아웃 → **소스 삭제** |
| `src/lib/analysis/jobs.ts` | 분석 작업 실행기 — 상태와 결과를 DB에 쓴다 |
| `src/db/schema.ts` · `repo.ts` | Drizzle 스키마와 저장·조회 레이어 |
| `src/lib/github/source.ts` | 출제용 코드 조회 — raw.githubusercontent.com, 커밋 SHA 고정, 크기 상한 |
| `src/lib/llm/*` | BYOK — 헤더 규약, 브라우저 보관(localStorage), Anthropic 최소 클라이언트 |
| `src/lib/quiz/prompts.ts` | 출제·채점 프롬프트 (crdd-mcp의 QUIZ_INSTRUCTIONS를 승격) |
| `src/lib/quiz/flow.ts` | 문항 단계 상태 머신 first → hint → explanation → unresolved |
| `src/lib/quiz/view.ts` | 단계에 맞게 rubric·힌트·설명을 걸러 화면으로 내보냄 |
| `src/db/quiz-repo.ts` · `score-repo.ts` | 퀴즈 세션 저장, 결과 → 점수 v2(누적+스무딩) 반영 |
| `src/auth.ts` | 로그인 (Auth.js v5, GitHub) — JWT 세션, 로그인 시 users upsert + 익명 기록 병합 |
| `src/lib/user.ts` | 현재 사용자 — 로그인 계정 ID, 아니면 익명 기기 ID 쿠키 |
| `src/db/merge-repo.ts` | 익명 기록 → 계정 이전 (겹치는 concept은 합친 이력으로 점수 재계산) |
| `src/lib/crdd/score.ts` | 배점 차등, 누적+스무딩, tier 가중치, overall 부채비율 (crdd-mcp에서 이식) |
| `src/lib/crdd/concepts.ts` | 커뮤니티 → concept 이름 (1차, 결정론적, LLM 불필요) |
| `src/lib/crdd/identity.ts` | concept 영속 키 — 재분석 때 파일 집합 유사도(Jaccard ≥ 0.5)로 기존 키를 이어받는다 |
| `src/lib/crdd/layout.ts` | force-directed 레이아웃. 시드 고정이라 같은 커밋 = 같은 그림 |
| `src/lib/crdd/map.ts` | 개념/파일 두 수준의 MapData 생성 |
| `src/lib/crdd/ignore.ts` | 분석 전 제외할 매니페스트·설정 파일 |
| `src/components/UnderstandingMap.tsx` | 개념/파일 보기 전환, 부채비율 오버레이 |
| `src/components/ui/*` | shadcn/ui 컴포넌트 (base-nova 프리셋) |
| `src/app/globals.css` | Tailwind v4 + shadcn 토큰을 CRDD 다크 팔레트로 덮은 곳 |

## 스타일

컨셉은 **이해도 커버리지** — 개발자가 매일 보는 에디터의 시각 언어를 빌린다.

- 테스트 커버리지 거터처럼, 설명할 수 있는 코드와 못 하는 코드를 줄 옆 막대로 (홈 히어로)
- 부채비율 단계는 진단 심각도로 읽는다: ok(30% 미만) / warning(30–54%) / error(55% 이상) / 미측정
- 상단은 에디터 탭 바, 하단은 상태 바(계정·API 키·테마)
- 글꼴은 UI 전체가 고정폭: 라틴·숫자는 JetBrains Mono, 한글은 나눔고딕코딩

Tailwind CSS v4 + shadcn/ui. 라이트·다크 토큰을 `src/app/globals.css`에 둘 다 정의하고
`<html data-theme>`로 바꾼다. 상태 바에서 시스템 → 라이트 → 다크로 돌리고, 선택은
localStorage에 저장한다. 첫 페인트 전에 인라인 스크립트가 적용해서 깜빡이지 않는다.
부채 색(`--debt-*`)은 진단 색이라 강조색(`--primary`, 커서 파랑)과 섞지 않는다.

## 데이터베이스

Turso(libSQL) + Drizzle ORM. `TURSO_DATABASE_URL`이 없으면 로컬 SQLite 파일
(`file:./local.db`)로 같은 코드가 돈다.

```bash
cp .env.example .env.local   # 값을 채운다
bun db:push                  # 스키마 적용
bun db:studio                # 데이터 확인
```

| 테이블 | 내용 |
|---|---|
| `projects` | 레포 하나 |
| `analyses` | 커밋 시점 스냅샷 — MapData, 파일 해시, 소요 시간 |
| `concepts` | 영속 키, 최신 communityId, 이름, nameSource(auto/llm/manual), 파일 목록 |
| `scores` | 사용자 × concept 키별 점수, lastVerifiedCommit (화면에는 부채비율만 노출) |
| `history` | 퀴즈 결과 이력 — 점수 공식이 과거 세션을 모두 합산한다 |
| `users` | 계정 — id = `github:<계정 번호>`, OAuth 토큰은 저장하지 않음 |
| `quizzes` | 퀴즈 세션 — 문항(rubric 포함, 서버 밖으로 그대로 안 나감)과 진행 상태 |
| `jobs` | 분석 작업 상태 |

### concept 키

Graphify의 커뮤니티 번호는 재분석마다 다시 매겨진다. 점수를 번호에 붙이면
재분석 뒤 엉뚱한 concept에 점수가 붙는다. 그래서 concept은 처음 생길 때
`c<communityId>-<파일 집합 해시>` 형태의 **영속 키**를 받고, 이후 재분석에서는
직전 concept과 파일 집합이 충분히 겹치면(Jaccard ≥ 0.5, 1:1 배정) 그 키를
이어받는다. 분석마다 `communityId → 키` 매핑을 따로 저장해서 과거 분석 화면도
정확한 점수를 보여준다.

### 마이그레이션

`drizzle/0001_concept_keys.sql`은 생성된 SQL에 `DEFAULT ''`와 기존 concept 백필을
손으로 더한 것이다 — SQLite는 기본값 없는 NOT NULL 컬럼을 기존 테이블에 추가하지
못한다. 기존 concept은 `c<번호>-legacy` 키를 받고, 다음 재분석 때 그 키를 이어받는다.

재분석해도 **사용자가 고친 concept 이름은 덮어쓰지 않는다** (`nameSource`가 auto가
아니면 유지). 큰 JSON은 지금 text 컬럼에 둔다 — porklog 기준 map 72KB, 해시 12KB.
수 MB가 되면 오브젝트 스토리지로 빼고 참조만 남기는 게 맞다.

## 배포 · CI/CD

Fly.io(도쿄 `nrt` — Fly에 서울 리전은 없다)에 단일 컨테이너로 올린다.

```
PR·main 푸시 → CI: bun install → typecheck → build
main CI 통과  → Deploy: flyctl deploy --remote-only → 헬스체크
```

처음 한 번은 손으로 준비해야 한다.

```bash
fly launch --no-deploy            # fly.toml이 이미 있으면 앱만 생성
fly secrets set TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=...
fly tokens create deploy -x 999999h   # 출력을 GitHub 시크릿 FLY_API_TOKEN에 등록
```

유휴 시 머신이 suspend로 잠든다. 데모 사이트라 비용을 아끼는 쪽을 택했고,
재개가 빨라 첫 요청 지연이 크지 않다.

## 퀴즈 루프

```
개념 선택 → POST /api/quiz (키 헤더)
  → 분석 스냅샷의 concept 키 → 커밋 고정 코드 최대 5파일 조회
  → LLM 출제 3문항 (awareness / understanding / reasoning)
→ 문항마다 POST /api/quiz/[id]/answer
  first ─틀림→ hint(놓친 포인트) ─틀림→ explanation(설명 후 자기 말로) ─틀림→ unresolved
  1.0          0.6                     0.3                                0.0
→ 마지막 문항이 끝나면 점수 v2로 concept 점수 갱신 → 지도에 부채비율
```

- 키는 브라우저 localStorage에만 두고 `x-crdd-llm-key` / `x-crdd-llm-model` 헤더로
  요청마다 보낸다. 서버는 그 요청 안에서만 쓰고 DB·로그·에러에 남기지 않는다
- "모르겠어요"는 LLM을 부르지 않고 출제 때 만든 힌트·설명으로 넘어간다
- 사용자는 로그인했으면 계정 ID, 아니면 익명 기기 ID 쿠키(`crdd_uid`)로 구분한다.
  로그인하면 그 브라우저의 익명 기록이 계정으로 옮겨진다

## 로그인

GitHub OAuth App을 만들고 Redirect URI에 `<주소>/api/auth/callback/github`를 넣는다
(로컬은 `http://localhost:3000/...`). 요청 scope는 기본값(read:user, user:email)뿐이라
레포 권한은 없다.

```bash
# .env.local (로컬) / fly secrets set (운영)
AUTH_SECRET=...        # bunx auth secret
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
```

운영의 `AUTH_URL`은 `fly.toml`에 고정돼 있다. standalone 서버는 요청 주소를 `0.0.0.0`으로
보기 때문에, 없으면 콜백 주소가 등록한 Redirect URI와 어긋난다.

| | 비로그인 | 로그인 |
|---|---|---|
| 데모·분석 결과 보기 | ✓ | ✓ |
| 새 레포 분석 | — | ✓ |
| 퀴즈 (본인 키) | ✓ (익명 ID에 기록) | ✓ |
| 내 프로젝트 | — | ✓ |

## 테스트

```bash
bun test          # 순수 함수 — concept 키 배정, 문항 상태 머신, 정답 유출 방지, 파일 선택
bun run typecheck
```

## 설계 원칙 (프로젝트 문서에서 확정)

- 입력은 **public GitHub 레포 링크만**. 업로드 없음
- **소스는 보관하지 않는다.** 분석 직후 삭제하고 그래프와 파일 해시만 남긴다
- 변경 감지는 git diff가 아니라 **blob SHA 스냅샷 비교** (`git ls-tree`로 clone 시점에 기록)
- LLM은 **BYOK** — 키는 사용자 기기 보관, 서버 미저장. 분석 단계는 LLM을 아예 쓰지 않는다
- 화면에는 **부채비율만** 표기. 이해도 점수는 내부 계산용
- concept 키는 이름도 communityId도 아닌 **영속 키** — 이름이 바뀌어도, 재분석으로 커뮤니티 번호가 바뀌어도 이력이 끊기지 않게

## 다음

1. concept 이름 2차 — 사용자 키로 LLM 다듬기 + 직접 수정 UI (`nameSource` 준비됨)
2. 데모 스냅샷을 실제 퀴즈 결과로 교체 (지금 `/demo` 부채비율은 예시 값)
3. Google 로그인 추가, 개념별 추이 그래프
4. 변경 감지 — 저장된 해시 스냅샷과 비교해 stale 표시
5. 작업 복구 — 실행 중 재시작하면 running 상태로 남는다
6. 데모 남용 방지 — 레이트 리밋, 레포 크기 상한, 동시 분석 수 제한
