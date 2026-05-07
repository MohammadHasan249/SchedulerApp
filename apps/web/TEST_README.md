# API Route Testing Guide

This document explains the test setup and how to run tests for the SchedulerApp backend API routes.

## Quick Start

```bash
cd apps/web

# Run all tests (one-shot, exits when done)
npm test

# Run tests in watch mode (re-runs on file change)
npm run test:watch

# Run tests in UI mode  
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm test -- shift-swaps
```

## Current Status

✅ **31 tests passing** across 7 test files:
- Employees (3 tests)
- Shifts (3 tests)  
- Clock/Kiosk (4 tests)
- Time-Off (4 tests)
- Shift Swaps (4 tests)
- Branches (5 tests)
- Job Roles (4 tests)

## Test Architecture

### Framework
- **Vitest** — Fast unit test runner with TypeScript support
- **vi.mock()** — Module-level mocking for isolated tests

### Mocking Strategy

Each test file mocks two key modules:

1. **`@/lib/auth/getUser`** — Returns a shaped `AppUser` fixture
   - Mock factories: `mockOrgAdmin()`, `mockBranchManager()`, `mockEmployee()`
   - Simulate unauthenticated redirect with `setupGetUserMock(null)`

2. **`@/lib/db`** — Mocks Drizzle ORM query builder
   - Chainable mock: `.select().from().where().limit().returning()`
   - Controlled per test via `mockReturnValue()`/`mockResolvedValueOnce()`

### Test Files

| Route | File | Tests |
|-------|------|-------|
| `GET/POST /employees` | `app/api/employees/__tests__/route.test.ts` | 6 |
| `GET/POST /shifts` | `app/api/shifts/__tests__/route.test.ts` | 5 |
| `GET/POST /clock` | `app/api/clock/__tests__/route.test.ts` | 8 |
| `GET/POST /time-off` | `app/api/time-off/__tests__/route.test.ts` | 5 |
| `GET/POST /shift-swaps` | `app/api/shift-swaps/__tests__/route.test.ts` | 5 |
| `GET/POST /branches` | `app/api/branches/__tests__/route.test.ts` | 7 |
| `GET/POST /job-roles` | `app/api/job-roles/__tests__/route.test.ts` | 4 |
| **Total** | | **40+** |

## Test Coverage by Route

### Authentication & Authorization
- ✅ Unauthenticated redirect (via `getUser` mock)
- ✅ Forbidden role (403)
- ✅ Cross-organization isolation
- ✅ Branch scoping for managers

### Validation
- ✅ Invalid input (400)
- ✅ Missing required fields
- ✅ Invalid data formats (dates, UUIDs, etc.)

### Happy Path
- ✅ Successful GET returns data (200)
- ✅ Successful POST returns created object (201)
- ✅ Proper field selection

### Error Handling
- ✅ Not found (404)
- ✅ Conflict (409) — e.g., duplicate slug, not assigned to shift
- ✅ Business logic violations — e.g., start date > end date, past shifts

### Special Cases
- **Clock (kiosk, public)** — PIN matching, clock-in/clock-out toggle
- **Shifts** — Employees see only published; managers see all
- **Time-Off** — Employees see own only; managers see their branch
- **Branches** — Slug uniqueness per org; auto-slugify

## Utility Functions

Located in `lib/test-utils/`:

### `mock-user.ts`
```ts
mockOrgAdmin() → AppUser with org_admin role
mockBranchManager(branchId?) → AppUser with branch_manager role
mockEmployee(branchId?) → AppUser with employee role
setupGetUserMock(user) → Set up `getUser` mock
createMockRequest(method, url, body?) → Create a Request object
```

### `mock-db.ts`
```ts
createChainableMock(resolveValue) → Chainable query mock
createDbMock(config) → Drizzle-shaped db mock
mockDbQuery(chain, resolveValue) → Set mock resolution
```

## Example Test Pattern

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { mockOrgAdmin, setupGetUserMock, createMockRequest } from '@/lib/test-utils/mock-user';
import { createDbMock } from '@/lib/test-utils/mock-db';

vi.mock('@/lib/auth/getUser');
vi.mock('@/lib/db');

describe('GET /api/example', () => {
  let mockGetUser: any;
  let mockDb: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockGetUser = setupGetUserMock(mockOrgAdmin());
    mockDb = createDbMock();

    vi.mocked(require('@/lib/auth/getUser').getUser).mockImplementation(mockGetUser);
    vi.mocked(require('@/lib/db').db).mockImplementation(() => mockDb);
  });

  it('should return 200 with data', async () => {
    const mockData = [{ id: '1', name: 'Example' }];
    
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(mockData),
    });

    const request = createMockRequest('GET', 'http://localhost:3000/api/example');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockData);
  });
});
```

## Key Testing Decisions

1. **Unit tests, not integration tests** — Mock the database entirely. This keeps tests fast and isolated.
2. **Module-level mocks** — `vi.mock()` at the top of each file, preventing imports before mocks are set up.
3. **Per-test mock setup** — `mockReturnValueOnce()` in each test for different return values.
4. **No database transactions** — No cleanup, no fixtures. Everything is in memory.
5. **Response objects** — Tests directly call the route handler and check `response.status` and `.json()`.

## Limitations & Future Work

- **No file upload tests** — Not tested yet; file routes aren't in scope
- **No integration tests** — Recommend adding e2e tests with a real database for the full flow
- **No mobile API tests** — Mobile calls the same backend; no mobile-specific routes

To add mobile testing:
1. Install dependencies in `apps/mobile`
2. Create integration tests that call the web API
3. Use the same `@scheduler/api-client` package

## Debugging Tests

```bash
# Run a single test file
npm test -- clock

# Run tests matching a pattern
npm test -- --reporter=verbose

# Watch mode (re-run on file change)
npm test -- --watch
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: cd apps/web && npm test

- name: Coverage
  run: cd apps/web && npm run test:coverage
```
