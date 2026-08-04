# --- Builder: installs full deps, generates the Prisma client, compiles TS ---
FROM node:24.18.1-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npx prisma generate

COPY src ./src
RUN npm run build

# --- Runtime: production deps only + compiled output ---
FROM node:24.18.1-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma/
COPY prisma.config.ts ./

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
