import { vi } from 'vitest';

// Mock common modules that all tests use
vi.mock('./lib/auth/getUser', () => ({
  getUser: vi.fn(),
}));

vi.mock('./lib/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));
