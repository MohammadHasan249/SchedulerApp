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

/**
 * Like `chain`, but the resolved rows depend on which table `.from(table)` is
 * called with — matched by reference against Drizzle's exported table objects
 * (e.g. `shifts`, `employees` from `@scheduler/database/schema`), not by call
 * order. Use this instead of a sequence of `.mockReturnValueOnce()` calls
 * whenever the code under test's `db.select` call order isn't something you
 * control — notably a live LLM deciding which tools to call and in what
 * order, where a fixed `.mockReturnValueOnce()` sequence would pass or fail
 * depending on tool-call order the model chose, not on actual behavior.
 *
 * Limitation: it cannot distinguish two different queries against the SAME
 * table with different `.where()` values (e.g. "does shift X already have
 * employee Y assigned" vs "what are employee Y's assignments this week" both
 * read `shiftAssignments`) — both get the same routed rows regardless of the
 * filter. Fine for fixtures where that doesn't matter for the case you're
 * testing; reach for a real seeded test database if it does.
 *
 * Usage: `(db.select as any).mockReturnValue(chainRoutedByTable(new Map([[shifts, [row]], [employees, []]])))`
 */
export function chainRoutedByTable(routes: Map<object, unknown[]>) {
  return () => {
    let result: unknown[] = [];
    const handler: ProxyHandler<object> = {
      get(target, prop) {
        if (prop === "from") {
          return (table: object) => {
            result = routes.get(table) ?? [];
            return proxy;
          };
        }
        if (prop === "then") {
          return (resolve: (v: unknown[]) => void) => resolve(result);
        }
        if (prop === "catch" || prop === "finally") {
          return () => proxy;
        }
        return vi.fn(() => proxy);
      },
    };
    const proxy: any = new Proxy({}, handler);
    return proxy;
  };
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
