# Bridge — Testing Guide

This document explains how to run tests and what you need to do on your end for the testing flow to work.

## Quick Start

```bash
# Run all tests (from project root)
npm run test

# Or run individually:
npm run test:backend   # 36 integration + unit tests
npm run test:frontend  # Component tests
```

## What's Set Up

### Backend
- **Vitest** + **supertest** for API integration tests
- Separate SQLite test DB (`prisma/test.db`) — migrations and seed run automatically
- Tests cover: auth, activities, pods, messages, locations config

### Frontend
- **Jest 29** + **jest-expo** + **React Native Testing Library**
- Component tests (e.g. `StatusBadge`)
- Mocks for `expo-haptics` and `expo-linear-gradient`

## Your Setup (One-Time)

### 1. Backend: Add `DATABASE_URL` to `.env`

The Prisma schema now uses `DATABASE_URL`. Create or update `backend/.env`:

```
DATABASE_URL="file:./dev.db"
```

Copy from `backend/.env.example` if you prefer.

### 2. Run Tests Before Commits

When you (or Cursor) implement features:

1. Run `cd backend && npm run test`
2. Run `cd frontend && npm run test`
3. Fix any failures before committing

## Cursor AI Integration

A Cursor rule (`.cursor/rules/testing.mdc`) instructs the AI to:
- Write tests when developing features
- Run tests before considering work done
- Follow existing test patterns

When you ask Cursor to build something, it will add tests and run them as part of the flow.

## Adding New Tests

### Backend
- Create `*.test.ts` next to the file or in `routes/`
- Use `request(app).get/post(...)` from supertest
- For protected routes: `registerAndGetToken()` then `set('Authorization', \`Bearer ${token}\`)`

### Frontend
- Create `*.test.tsx` next to the component or in `__tests__/`
- Use `render()` and `screen.getByText()` from `@testing-library/react-native`
- Add mocks in `jest.setup.js` for new native/Expo modules
