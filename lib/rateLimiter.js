'use strict';

const DEFAULT_WINDOW_MS = 60_000;

const DEFAULT_POLICIES = {
  default: { windowMs: DEFAULT_WINDOW_MS, max: 120 },
  healthRead: { windowMs: DEFAULT_WINDOW_MS, max: 180 },
  adminRead: { windowMs: DEFAULT_WINDOW_MS, max: 120 },
  adminMutation: { windowMs: DEFAULT_WINDOW_MS, max: 30 },
  standardRun: { windowMs: DEFAULT_WINDOW_MS, max: 30 },
  conversation: { windowMs: DEFAULT_WINDOW_MS, max: 60 },
  evidenceIndex: { windowMs: DEFAULT_WINDOW_MS, max: 24 },
  evidenceSearch: { windowMs: DEFAULT_WINDOW_MS, max: 90 },
  reviewPack: { windowMs: DEFAULT_WINDOW_MS, max: 24 },
  backendRelay: { windowMs: DEFAULT_WINDOW_MS, max: 36 },
  caseNarrative: { windowMs: DEFAULT_WINDOW_MS, max: 36 }
};

const buckets = new Map();

function cleanPolicyName(value = '') {
  return String(value || 'default')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    || 'default';
}

function envNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function policyConfig(policyName = 'default', overrides = {}) {
  const name = cleanPolicyName(policyName);
  const defaults = DEFAULT_POLICIES[name] || DEFAULT_POLICIES.default;
  const envPrefix = `P42_RATE_LIMIT_${name.toUpperCase()}`;
  return {
    name,
    windowMs: Number(overrides.windowMs) > 0
      ? Number(overrides.windowMs)
      : envNumber(`${envPrefix}_WINDOW_MS`, defaults.windowMs),
    max: Number(overrides.max) > 0
      ? Number(overrides.max)
      : envNumber(`${envPrefix}_MAX`, defaults.max)
  };
}

function clientKey(req = {}) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded
    || req.headers?.['x-real-ip']
    || req.socket?.remoteAddress
    || req.connection?.remoteAddress
    || 'unknown';
}

function rateLimitKey(req, policy) {
  return `${policy.name}:${clientKey(req)}`;
}

function pruneExpired(now = Date.now()) {
  for (const [key, bucket] of buckets.entries()) {
    if (!bucket || bucket.resetAt <= now) buckets.delete(key);
  }
}

function checkRateLimit(req = {}, policyName = 'default', overrides = {}) {
  const policy = policyConfig(policyName, overrides);
  const now = Date.now();
  pruneExpired(now);
  const key = rateLimitKey(req, policy);
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + policy.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, policy.max - bucket.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > policy.max) {
    return {
      ok: false,
      statusCode: 429,
      policy: policy.name,
      limit: policy.max,
      remaining: 0,
      retryAfterSeconds,
      body: {
        ok: false,
        error: 'rate_limited',
        detail: 'Too many requests. Retry shortly.',
        policy: policy.name,
        retryAfterSeconds
      }
    };
  }
  return {
    ok: true,
    policy: policy.name,
    limit: policy.max,
    remaining,
    retryAfterSeconds
  };
}

function resetRateLimiter() {
  buckets.clear();
}

module.exports = {
  checkRateLimit,
  clientKey,
  policyConfig,
  resetRateLimiter
};
