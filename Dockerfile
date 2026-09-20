# Node와 Python을 한 이미지에 담는다.
#
# Graphify는 Python CLI다. 라이브러리로 import하는 게 아니라 명령어 하나를
# 자식 프로세스로 실행할 뿐이라, 서비스를 둘로 쪼개지 않고 앱과 분석기를 같은
# 컨테이너에 넣는다. 그래서 배포 대상은 Vercel이 아니라 Fly.io·Railway 같은
# 컨테이너 호스팅이다.
#
# 설치와 빌드는 bun, 런타임은 node.
# bun이 빠르고(콜드 캐시 2.2s vs npm 9.8s), 런타임을 node로 두는 건 Next
# standalone 서버와 자식 프로세스 실행이 가장 검증된 조합이기 때문이다.

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

# git: 얕은 clone / python3 + graphifyy: 구조 추출
RUN apt-get update \
 && apt-get install -y --no-install-recommends git python3 python3-pip ca-certificates \
 && pip install --no-cache-dir --break-system-packages graphifyy \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
