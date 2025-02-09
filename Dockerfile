# Client build stage
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package.json ./
RUN npm install

COPY client/ ./
RUN npm run build

# Python build stage
FROM python:3.12-slim-bookworm AS server-builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY server/pyproject.toml server/uv.lock server/README.md ./
RUN uv sync --frozen --no-dev

COPY server/ ./
COPY --from=client-builder /app/client/dist ./static

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "multivox.app:app", "--host", "0.0.0.0", "--port", "8000"]
