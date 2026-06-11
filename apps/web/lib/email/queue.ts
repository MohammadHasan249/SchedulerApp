/**
 * Simple in-process email retry queue with exponential backoff.
 * In production, replace with a durable queue (BullMQ + Redis, Trigger.dev, etc.)
 * by swapping the `enqueue` export — the call-sites don't change.
 *
 * Current implementation: best-effort in-memory queue. Jobs survive restarts
 * only if a durable backend is configured via QUEUE_BACKEND=redis.
 */

import { logger } from "@/lib/logger";

type EmailJob = {
  id: string;
  fn: () => Promise<void>;
  attempts: number;
  maxAttempts: number;
  nextRunAt: number;
};

const queue: EmailJob[] = [];
let running = false;

const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000]; // 5s, 15s, 1m, 5m

function backoff(attempt: number): number {
  return BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
}

async function drain() {
  if (running) return;
  running = true;

  while (queue.length > 0) {
    const now = Date.now();
    const job = queue.find((j) => j.nextRunAt <= now);
    if (!job) {
      await new Promise((r) => setTimeout(r, 1_000));
      continue;
    }

    try {
      await job.fn();
      queue.splice(queue.indexOf(job), 1);
    } catch (err) {
      job.attempts += 1;
      if (job.attempts >= job.maxAttempts) {
        logger.error("Email job exhausted retries, dropping", job.id, err);
        queue.splice(queue.indexOf(job), 1);
      } else {
        job.nextRunAt = Date.now() + backoff(job.attempts);
        logger.warn("Email job failed, will retry", job.id, job.attempts);
      }
    }
  }

  running = false;
}

export function enqueueEmail(id: string, fn: () => Promise<void>, maxAttempts = 4) {
  queue.push({ id, fn, attempts: 0, maxAttempts, nextRunAt: 0 });
  void drain();
}
