import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const _pino = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

// Wrap pino so call sites can use the same `logger.error(msg, data?)` style
// as console.error without needing to restructure every call site.
export const logger = {
  info:  (msg: string, ...args: unknown[]) => _pino.info({ data: args }, msg),
  warn:  (msg: string, ...args: unknown[]) => _pino.warn({ data: args }, msg),
  error: (msg: string, ...args: unknown[]) => _pino.error({ data: args }, msg),
  debug: (msg: string, ...args: unknown[]) => _pino.debug({ data: args }, msg),
};
