const generateKey = (args) => JSON.stringify(args);
export function memorize(fn) {
  const cache = /* @__PURE__ */ new Map();
  const memorized = (...args) => {
    const key = generateKey(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  return memorized;
}
