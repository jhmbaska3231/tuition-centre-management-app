# backend/Dockerfile
# build from the repository root: docker build -f backend/Dockerfile -t tuition-backend .

FROM node:22-alpine AS builder
WORKDIR /app

# every workspace manifest must be present or npm ci cannot validate the lockfile
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @tuition/shared --workspace backend

COPY shared/ shared/
COPY backend/tsconfig.json backend/
COPY backend/src/ backend/src/
RUN npm run build -w @tuition/shared && npm run build -w backend

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --omit=dev --workspace @tuition/shared --workspace backend && npm cache clean --force

COPY --from=builder /app/shared/dist shared/dist
COPY --from=builder /app/backend/dist backend/dist

# the node image ships an unprivileged user, files stay root owned and read only to it
USER node
EXPOSE 8080
# the worker deployment overrides this with: node backend/dist/worker.js
CMD ["node", "backend/dist/index.js"]