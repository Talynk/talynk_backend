# syntax=docker/dockerfile:1

# --- Base build stage ---
FROM node:20-slim AS base
WORKDIR /app

# Install system deps required by sharp/ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  python3 \
  build-essential \
  ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# Generate Prisma client at build time (reduces startup work)
RUN npx prisma generate

# --- Runtime stage ---
FROM node:20-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
  PORT=3000

# System deps for sharp/ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY --from=base /app /app

# Expose app port
EXPOSE 3000

# Healthcheck (expects /api/test or root to respond 200)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+process.env.PORT+'/api/test',r=>{if(r.statusCode<400)process.exit(0);process.exit(1)}).on('error',()=>process.exit(1))" || exit 1

# Run Prisma migrations then start app
CMD ["sh", "-c", "npx prisma migrate deploy && node src/app.js"]


