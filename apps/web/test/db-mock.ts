import { vi } from "vitest";

/**
 * Drizzle query builders are thenables — `db.select().from(x).where(y)` can be
 * awaited directly without a terminal call. This builds a chainable mock where
 * every method (from/where/limit/orderBy/returning/...) returns itself, and
 * awaiting the chain at any point resolves to `result`.
 *
 * Usage: `(db.select as any).mockReturnValue(chain(rows))`
 */
export function chain<T>(result: T) {
  const handler: ProxyHandler<object> = {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: T) => void) => resolve(result);
      }
      if (prop === "catch" || prop === "finally") {
        return () => proxy;
      }
      return vi.fn(() => proxy);
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
}

/** A chain that rejects instead of resolving — for error-path tests. */
export function rejectingChain(error: unknown) {
  const handler: ProxyHandler<object> = {
    get(target, prop) {
      if (prop === "then") {
        return (_resolve: unknown, reject: (e: unknown) => void) => reject(error);
      }
      if (prop === "catch") {
        return (reject: (e: unknown) => void) => reject(error);
      }
      return vi.fn(() => proxy);
    },
  };
  const proxy: any = new Proxy({}, handler);
  return proxy;
}
