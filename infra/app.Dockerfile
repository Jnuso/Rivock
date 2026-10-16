FROM node:24.19.0-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# This is a public browser key. Secrets must never be build arguments.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_API_URL=/api/v1 RIVOCK_PRODUCTION_BUILD=true
RUN test -n "$VITE_CLERK_PUBLISHABLE_KEY" && npm run build

FROM python:3.12.14-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 STATIC_FILES_DIRECTORY=/app/frontend
WORKDIR /app
COPY backend/requirements.lock backend/pyproject.toml ./
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/app ./app
COPY backend/migrations ./migrations
COPY backend/alembic.ini ./
COPY --from=frontend /build/dist ./frontend
RUN pip install --no-cache-dir --no-deps . && useradd --uid 10001 --create-home rivock
USER 10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log", "--no-proxy-headers"]
