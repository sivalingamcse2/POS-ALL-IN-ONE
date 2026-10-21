const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_TRACKED_ADDRESSES = 5000;
const failures = new Map();

const pruneExpired = now => {
  for (const [address, entry] of failures) {
    if (entry.resetAt <= now) failures.delete(address);
  }
  while (failures.size > MAX_TRACKED_ADDRESSES) {
    failures.delete(failures.keys().next().value);
  }
};

const loginRateLimit = (req, res, next) => {
  const now = Date.now();
  const address = String(req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  let attempts = failures.get(address);
  if (!attempts || attempts.resetAt <= now) {
    attempts = { count: 0, resetAt: now + WINDOW_MS };
  }

  if (attempts.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((attempts.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' });
  }

  pruneExpired(now);
  res.once('finish', () => {
    if (res.statusCode === 401) {
      attempts.count += 1;
      failures.set(address, attempts);
    } else if (res.statusCode < 400) {
      failures.delete(address);
    }
  });
  return next();
};

module.exports = loginRateLimit;
