import { kv } from "@vercel/kv";

const isKvConfigured = !!(
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
);

if (!isKvConfigured) {
  console.warn(
    "Vercel KV environment variables (KV_REST_API_URL, KV_REST_API_TOKEN) are missing. " +
    "Server-side caching is disabled, and requests will fall back directly to the database/API."
  );
}

export const kvCache = {
  /**
   * Set value in cache with optional TTL in seconds
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!isKvConfigured) return;
    try {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);
      if (ttlSeconds) {
        await kv.set(key, stringValue, { ex: ttlSeconds });
      } else {
        await kv.set(key, stringValue);
      }
    } catch (error) {
      console.error(`[KVCache] Error setting key "${key}":`, error);
    }
  },

  /**
   * Get value from cache with auto-JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isKvConfigured) return null;
    try {
      const data = await kv.get<string>(key);
      if (data === null || data === undefined) return null;
      
      // If it looks like a JSON string/object, parse it
      if (typeof data === "string") {
        try {
          return JSON.parse(data) as T;
        } catch {
          return data as unknown as T;
        }
      }
      return data as T;
    } catch (error) {
      console.error(`[KVCache] Error getting key "${key}":`, error);
      return null;
    }
  },

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    if (!isKvConfigured) return;
    try {
      await kv.del(key);
    } catch (error) {
      console.error(`[KVCache] Error deleting key "${key}":`, error);
    }
  },

  /**
   * High level wrapper: gets from cache, otherwise executes fetchFn, stores in cache, and returns.
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    if (!isKvConfigured) {
      return fetchFn();
    }

    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const freshData = await fetchFn();
    await this.set(key, freshData, ttlSeconds);
    return freshData;
  }
};
