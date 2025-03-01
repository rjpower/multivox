# Client build stage
FROM node:22-slim AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN mkdir -p dist
RUN npm run build

# Python build stage
FROM mcr.microsoft.com/playwright:v1.50.0-noble
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_LINK_MODE=copy
COPY server/pyproject.toml server/uv.lock server/README.md ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --frozen
RUN uv run playwright install chromium

COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

RUN mkdir -p data downloads
VOLUME ["/app/data", "/app/downloads"]

EXPOSE 8000

ENV ROOT_DIR=/app
ENV SECRETS_DIR=/run/secrets
CMD ["uv", "run", "uvicorn", "multivox.app:app", "--workers=8", "--host", "0.0.0.0", "--port", "8000", "--forwarded-allow-ips", "*"]
