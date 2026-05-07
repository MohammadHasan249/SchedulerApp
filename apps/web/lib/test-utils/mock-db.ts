import { vi } from 'vitest';

export function createChainableMock(resolveValue: any = []) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(resolveValue),
    execute: vi.fn().mockResolvedValue(resolveValue),
  };

  return chain;
}

export function createDbMock(config: Record<string, any> = {}) {
  const db: any = {
    select: vi.fn().mockReturnValue(createChainableMock()),
    insert: vi.fn().mockReturnValue(createChainableMock()),
    update: vi.fn().mockReturnValue(createChainableMock()),
    delete: vi.fn().mockReturnValue(createChainableMock()),
    ...(config || {})
  };

  return db;
}

export function mockDbQuery(chain: any, resolveValue: any) {
  chain.returning?.mockResolvedValueOnce(resolveValue);
  chain.execute?.mockResolvedValueOnce(resolveValue);
  chain.mockResolvedValueOnce?.(resolveValue);
  return chain;
}
