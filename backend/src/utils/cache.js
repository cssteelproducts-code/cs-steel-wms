'use strict';
// Shared TTL cache with promise coalescing.
// Prevents cache stampede: if 50 concurrent requests all miss the same cold key,
// only one DB fetch runs — the rest await the same in-flight promise.

const _store = new Map();

// Purge expired non-in-flight entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _store) if (!v.promise && now > v.exp) _store.delete(k);
}, 60_000).unref();

/**
 * Fetch-or-compute a cached value.
 * @param {string}   key   - Cache key
 * @param {Function} fn    - Async function that produces the value
 * @param {number}   ttlMs - Time-to-live in milliseconds
 * @returns {Promise<any>} Cached or freshly fetched value
 */
async function wrap(key, fn, ttlMs) {
  const e = _store.get(key);
  if (e) {
    if (e.promise) return e.promise;           // in-flight: coalesce
    if (Date.now() < e.exp) return e.data;     // warm: return immediately
  }

  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  _store.set(key, { promise, exp: 0 });

  try {
    const data = await fn();
    _store.set(key, { data, exp: Date.now() + ttlMs });
    resolve(data);
    return data;
  } catch (err) {
    _store.delete(key);
    reject(err);
    throw err;
  }
}

/** Delete one or more cache entries (use after mutations to force re-fetch). */
function del(...keys) {
  keys.forEach(k => _store.delete(k));
}

module.exports = { wrap, del };
