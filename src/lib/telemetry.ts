/**
 * Flattens a nested object into a single-level object with dot-notation keys.
 * Now handles arrays recursively using index notation (e.g., drones.0.telemetry).
 */
export function flattenObject(obj: any, prefix = ''): Record<string, any> {
  if (obj === null || typeof obj !== 'object') {
    return { [prefix]: obj };
  }

  return Object.keys(obj).reduce((acc: any, k: string) => {
    const pre = prefix.length ? prefix + '.' : '';
    const value = obj[k];

    if (typeof value === 'object' && value !== null) {
      Object.assign(acc, flattenObject(value, pre + k));
    } else {
      acc[pre + k] = value;
    }
    return acc;
  }, {});
}

/**
 * Compares two flattened objects and returns keys that have different values.
 */
export function getDiff(prev: Record<string, any>, curr: Record<string, any>): Set<string> {
  const diffs = new Set<string>();
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(curr)]);

  for (const key of allKeys) {
    if (JSON.stringify(prev[key]) !== JSON.stringify(curr[key])) {
      diffs.add(key);
    }
  }

  return diffs;
}
