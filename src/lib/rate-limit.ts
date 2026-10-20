/**
 * Small fixed-window rate limiter kept in memory. Good enough for a single
 * server process; a multi-instance deployment would move this to Redis.
 */
const windows = new Map<string, { startedAt: number; count: number }>();

function pruneExpired(now: number, windowMs: number) {
  for (const [key, window] of windows) {
    if (now - window.startedAt >= windowMs) windows.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  if (windows.size > 1000) pruneExpired(now, windowMs);

  const current = windows.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    windows.set(key, { startedAt: now, count: 1 });
    return { ok: true };
  }
  if (current.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((current.startedAt + windowMs - now) / 1000) };
  }
  current.count += 1;
  return { ok: true };
}
