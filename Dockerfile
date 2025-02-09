# Client build stage
FROM node:22-slim AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci

COPY client/ ./
RUN mkdir -p dist
RUN npm run build

# Python build stage
FROM python:3.12-slim-bookworm
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY server/pyproject.toml server/uv.lock server/README.md ./
RUN uv sync --frozen

COPY server/ ./
COPY --from=client-builder /app/client/dist /app/client/dist

EXPOSE 8000

ENV ROOT_DIR=/app
CMD ["uv", "run", "uvicorn", "multivox.app:app", "--host", "0.0.0.0", "--port", "8000", "--forwarded-allow-ips", "*"]
