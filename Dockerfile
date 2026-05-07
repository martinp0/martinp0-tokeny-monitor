# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Accept build args for env variables
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID

COPY package.json bun.lockb* package-lock.json* ./
RUN npm install --frozen-lockfile 2>/dev/null || npm install

COPY . .
RUN npm run build

# ── Stage 2: Serve ─────────────────────────────────────────
FROM nginx:alpine AS production

# Custom nginx config for SPA routing
COPY --from=builder /app/dist /usr/share/nginx/html

RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml; \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
