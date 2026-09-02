import pino from "pino";
import * as Sentry from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

const _pino = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

// Most call sites catch an error, log it, and return a handled response
// instead of rethrowing — which means Sentry's automatic onRequestError
// capture never sees it. Reporting from here catches those retroactively,
// for every existing and future logger.error() call, without touching each
// call site.
function reportToSentry(msg: string, args: unknown[]) {
  const err = args.find((a) => a instanceof Error);
  if (err) {
    Sentry.captureException(err, { extra: { message: msg } });
  } else {
    Sentry.captureMessage(msg, { level: "error", extra: { data: args } });
  }
}

// Wrap pino so call sites can use the same `logger.error(msg, data?)` style
// as console.error without needing to restructure every call site.
export const logger = {
  info:  (msg: string, ...args: unknown[]) => _pino.info({ data: args }, msg),
  warn:  (msg: string, ...args: unknown[]) => _pino.warn({ data: args }, msg),
  error: (msg: string, ...args: unknown[]) => {
    _pino.error({ data: args }, msg);
    reportToSentry(msg, args);
  },
  debug: (msg: string, ...args: unknown[]) => _pino.debug({ data: args }, msg),
};
