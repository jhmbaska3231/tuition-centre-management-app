# frontend/Dockerfile
# build from the repository root: docker build -f frontend/Dockerfile -t tuition-frontend .

FROM node:22-alpine AS builder
WORKDIR /app

# every workspace manifest must be present or npm ci cannot validate the lockfile
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @tuition/shared --workspace @tuition/frontend

COPY shared/ shared/
COPY frontend/ frontend/
RUN npm run build -w @tuition/shared && npm run build -w @tuition/frontend

# unprivileged variant runs as a non root user and listens on 8080 by default
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080