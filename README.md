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
- `/a/[id]` — 진행 상태 → 완료 시 Understanding Map (퀴즈 전이라 전부 콜드 스타트)
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
| `src/lib/crdd/score.ts` | 배점 차등, 누적+스무딩, tier 가중치, overall 부채비율 (crdd-mcp에서 이식) |
| `src/lib/crdd/concepts.ts` | 커뮤니티 → concept 이름 (1차, 결정론적, LLM 불필요) |
| `src/lib/crdd/layout.ts` | force-directed 레이아웃. 시드 고정이라 같은 커밋 = 같은 그림 |
| `src/lib/crdd/map.ts` | 개념/파일 두 수준의 MapData 생성 |
| `src/lib/crdd/ignore.ts` | 분석 전 제외할 매니페스트·설정 파일 |
| `src/components/UnderstandingMap.tsx` | 개념/파일 보기 전환, 부채비율 오버레이 |
| `src/components/ui/*` | shadcn/ui 컴포넌트 (base-nova 프리셋) |
| `src/app/globals.css` | Tailwind v4 + shadcn 토큰을 CRDD 다크 팔레트로 덮은 곳 |

## 스타일

Tailwind CSS v4 + shadcn/ui. 다크 단일 테마다 — shadcn 토큰 값 자체를 CRDD 팔레트로
덮고, 부채비율 표시용 의미 색(`--debt-ok/warn/crit/cold`)을 따로 둔다. 이 네 색은
브랜드 강조색(`--primary`)과 분리해서 쓴다. 상태 색과 강조 색을 섞으면 신호가 죽는다.

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
| `concepts` | communityId, 이름, nameSource(auto/llm/manual), 파일 목록 |
| `scores` | concept별 점수, lastVerifiedCommit (화면에는 부채비율만 노출) |
| `history` | 퀴즈 결과 이력 — 점수 공식이 과거 세션을 모두 합산한다 |
| `jobs` | 분석 작업 상태 |

재분석해도 **사용자가 고친 concept 이름은 덮어쓰지 않는다** (`nameSource`가 auto가
아니면 유지). 큰 JSON은 지금 text 컬럼에 둔다 — porklog 기준 map 72KB, 해시 12KB.
수 MB가 되면 오브젝트 스토리지로 빼고 참조만 남기는 게 맞다.

## 설계 원칙 (프로젝트 문서에서 확정)

- 입력은 **public GitHub 레포 링크만**. 업로드 없음
- **소스는 보관하지 않는다.** 분석 직후 삭제하고 그래프와 파일 해시만 남긴다
- 변경 감지는 git diff가 아니라 **blob SHA 스냅샷 비교** (`git ls-tree`로 clone 시점에 기록)
- LLM은 **BYOK** — 키는 사용자 기기 보관, 서버 미저장. 분석 단계는 LLM을 아예 쓰지 않는다
- 화면에는 **부채비율만** 표기. 이해도 점수는 내부 계산용
- concept 키는 이름이 아니라 **communityId** — 이름이 바뀌어도 이력이 끊기지 않게

## 다음 (P2 이후)

1. 퀴즈 루프 — 키 입력 UI, 출제·채점, concept 점수 반영
2. 로그인 — Auth.js GitHub/Google. 지금 `scores.userId`는 "local" 고정
3. 변경 감지 — 저장된 해시 스냅샷과 비교해 stale 표시
4. 작업 복구 — 실행 중 재시작하면 running 상태로 남는다
5. 데모 남용 방지 — 레이트 리밋, 레포 크기 상한
