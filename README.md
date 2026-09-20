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

필요한 것: Node 22+, `git`, 그리고 PATH에 `graphify`.

```bash
uv tool install graphifyy   # 없으면
pnpm install
pnpm dev                    # http://localhost:3000
```

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
| `src/lib/analysis/jobs.ts` | 인메모리 작업 큐 (P3에서 Postgres로) |
| `src/lib/crdd/score.ts` | 배점 차등, 누적+스무딩, tier 가중치, overall 부채비율 (crdd-mcp에서 이식) |
| `src/lib/crdd/concepts.ts` | 커뮤니티 → concept 이름 (1차, 결정론적, LLM 불필요) |
| `src/lib/crdd/layout.ts` | force-directed 레이아웃. 시드 고정이라 같은 커밋 = 같은 그림 |
| `src/lib/crdd/map.ts` | 개념/파일 두 수준의 MapData 생성 |
| `src/lib/crdd/ignore.ts` | 분석 전 제외할 매니페스트·설정 파일 |
| `src/components/UnderstandingMap.tsx` | 개념/파일 보기 전환, 부채비율 오버레이 |

## 설계 원칙 (프로젝트 문서에서 확정)

- 입력은 **public GitHub 레포 링크만**. 업로드 없음
- **소스는 보관하지 않는다.** 분석 직후 삭제하고 그래프와 파일 해시만 남긴다
- 변경 감지는 git diff가 아니라 **blob SHA 스냅샷 비교** (`git ls-tree`로 clone 시점에 기록)
- LLM은 **BYOK** — 키는 사용자 기기 보관, 서버 미저장. 분석 단계는 LLM을 아예 쓰지 않는다
- 화면에는 **부채비율만** 표기. 이해도 점수는 내부 계산용
- concept 키는 이름이 아니라 **communityId** — 이름이 바뀌어도 이력이 끊기지 않게

## 다음 (P2 이후)

1. 퀴즈 루프 — 키 입력 UI, 출제·채점, concept 점수 반영
2. 저장소 — 인메모리 작업 큐와 결과를 Postgres로
3. 로그인 — Auth.js GitHub/Google (신원 확인만)
4. 변경 감지 — 저장된 해시 스냅샷과 비교해 stale 표시
5. 데모 남용 방지 — 레이트 리밋, 레포 크기 상한
