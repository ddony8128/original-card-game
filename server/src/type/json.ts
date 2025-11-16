export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export function isJsonValue(value: unknown): value is Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((v) => isJsonValue(v));
  }
  if (typeof value === 'object') {
    for (const [, v] of Object.entries(value as Record<string, unknown>)) {
      if (!isJsonValue(v)) return false;
    }
    return true;
  }
  return false;
}

export function coerceJson(raw: unknown): Json | null {
  if (raw === null || raw === undefined) return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new Error('Invalid JSON string');
    }
  }
  if (!isJsonValue(value)) {
    throw new Error('Value is not valid JSON');
  }
  return value as Json;
}
