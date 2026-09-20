# Node와 Python을 한 이미지에 담는다.
#
# Graphify는 Python CLI라 Next.js 서버리스 함수 안에서 돌릴 수 없다. 서비스를
# 둘로 쪼개는 대신, 앱과 분석기를 같은 컨테이너에 넣고 Next가 graphify를
# 자식 프로세스로 실행한다. 그래서 Vercel이 아니라 Fly.io/Railway 같은
# 컨테이너 호스팅에 올린다.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN corepack enable && pnpm install --frozen-lockfile || npm install

FROM node:22-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && (pnpm build || npm run build)

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
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
