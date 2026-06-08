import Redis from "ioredis";

const redisUrl = process.env.KV_REDIS_URL || process.env.KV_URL;

let redis: Redis | null = null;

if (redisUrl) {
  try {
    // Prevent multiple connections during hot-reloads in development
    if (process.env.NODE_ENV === "development") {
      if (!(global as any)._redisClient) {
        (global as any)._redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
        });
      }
      redis = (global as any)._redisClient;
    } else {
      redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
      });
    }
  } catch (err) {
    console.error("[KVCache] Redis initialization failed:", err);
  }
} else {
  console.warn(
    "[KVCache] KV_REDIS_URL or KV_URL environment variable is missing. Caching is disabled."
  );
}

export const kvCache = {
  /**
   * Set value in cache with optional TTL in seconds
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!redis) return;
    try {
      const stringValue = typeof value === "string" ? value : JSON.stringify(value);
      if (ttlSeconds) {
        await redis.set(key, stringValue, "EX", ttlSeconds);
      } else {
        await redis.set(key, stringValue);
      }
    } catch (error) {
      console.error(`[KVCache] Error setting key "${key}":`, error);
    }
  },

  /**
   * Get value from cache with auto-JSON parsing
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;
    try {
      const data = await redis.get(key);
      if (data === null || data === undefined) return null;

      try {
        return JSON.parse(data) as T;
      } catch {
        return data as unknown as T;
      }
    } catch (error) {
      console.error(`[KVCache] Error getting key "${key}":`, error);
      return null;
    }
  },

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(key);
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
    if (!redis) {
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
export { redis };
