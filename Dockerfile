# syntax=docker/dockerfile:1

# --- Base build stage ---
FROM node:20-slim AS base
WORKDIR /app

# Install minimal build deps required by sharp/node-gyp (no ffmpeg needed at build time)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  python3 \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

# Ensure production install for smaller dependency set
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

# Copy only Prisma schema first to leverage layer caching for client generation
COPY prisma ./prisma
# Generate Prisma client at build time (reduces startup work)
RUN npx prisma generate

# Copy application source last
COPY . .

# --- Runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
  PORT=3000

# Runtime deps (ffmpeg required by fluent-ffmpeg/sharp image ops)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY --from=base /app /app

# Ensure uploads directory exists and is writable
RUN mkdir -p /app/uploads && chown -R node:node /app

# Expose app port
EXPOSE 3000

# Healthcheck (expects /api/test or root to respond 200)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/api/test',r=>{if(r.statusCode<400)process.exit(0);process.exit(1)}).on('error',()=>process.exit(1))" || exit 1

# Drop privileges to non-root for better security
USER node

# Run Prisma migrations then start app (Prisma uses DATABASE_URL from env)
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]


