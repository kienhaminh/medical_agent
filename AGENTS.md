# AI Agent Development Guide

You are working on an AI agent system with a FastAPI backend and Next.js frontend.

## Quick Reference

**Stack:** Python 3.12+, FastAPI, LangGraph, PostgreSQL+pgvector, Next.js 16, TypeScript, Tailwind v4, Shadcn/ui

**Core Principles:** YANGI (You Aren't Gonna Need It) + KISS (Keep It Simple) + DRY (Don't Repeat Yourself)

## Before You Start

1. **Read** `./README.md` for project context
2. **Review** `./docs/system-architecture.md` for architecture
3. **Check** `./docs/code-standards.md` for coding standards

## Development Workflow

```
Planning → Implementation → Testing → Code Review → Documentation
```

1. **Plan** - Create implementation plan in `./plans` directory
2. **Implement** - Write clean code, update existing files (no "enhanced" files)
3. **Test** - Write tests, ensure all pass (no mocks to fake passing)
4. **Review** - Check against `./docs/code-standards.md`
5. **Document** - Update `./docs` as needed

## File Rules

- **Naming:** Use kebab-case (e.g., `langgraph-agent.py`)
- **Size:** Keep files under 200 lines
- **Operations:** Edit existing files, don't create new ones unless necessary

## Critical Rules

- ✅ DO: Update existing files directly
- ✅ DO: Fix all failing tests before finishing
- ✅ DO: Run compile/build after code changes
- ✅ DO: Use real implementations in tests
- ❌ DON'T: Create "enhanced" files
- ❌ DON'T: Ignore failing tests
- ❌ DON'T: Use mocks/fakes to pass tests
- ❌ DON'T: Commit secrets (.env, API keys)
- ❌ DON'T: Over-engineer solutions

## Testing Commands

```bash
# Backend
pytest
pytest --cov=src --cov-report=html
black src/ && ruff check src/

# Frontend
cd web && npm run build
```

## Pre-commit Checklist

- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Linting passes
- [ ] No secrets in commit
- [ ] Conventional commit message

## Documentation Updates

Update after: feature implementation, bug fixes, security updates, breaking changes

Files: `project-roadmap.md`, `project-changelog.md`, `system-architecture.md`, `code-standards.md`
