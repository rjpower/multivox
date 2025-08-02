# MULTIVOX DEVELOPMENT GUIDE

## COMMANDS
- **Server**: `uv run uvicorn multivox.app:app --reload --workers 1 --limit-concurrency 100 --backlog 512`
- **Client**: `cd client && pnpm run dev-server`
- **Tests**: `cd server && pytest` or `cd server && pytest tests/test_file.py::test_name`
- **Typecheck**: `cd client && pnpm run typecheck`
- **Build**: `cd client && pnpm run build`

## CODE STYLE
### TypeScript
- Use strict typing with interfaces for props and state
- PascalCase for components, camelCase for functions/variables
- Arrow functions for components and callbacks
- Organize imports: React/libraries first, then local imports
- Use Tailwind for styling with descriptive class names
- Jotai for state management

### Python
- Python 3.12 with type hints everywhere
- Pydantic for models and validation
- snake_case for functions, PascalCase for classes, UPPER_CASE for constants
- Organize imports: stdlib → third-party → local
- Descriptive docstrings for functions
- Specific error handling with try/except blocks