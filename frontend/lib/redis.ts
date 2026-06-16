import Redis from "ioredis";

let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL);
    redis.on("error", (err) => {
      console.warn("Redis error, using fallback in-memory cache:", err.message);
    });
  } catch (e) {
    console.warn("Failed to initialize Redis, using fallback in-memory cache");
  }
} else {
  console.log("No REDIS_URL found in environment. Using in-memory fallback cache.");
}

// Fallback in-memory store
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

export async function getLock(key: string): Promise<string | null> {
  if (redis) {
    try {
      return await redis.get(key);
    } catch (e) {
      console.warn("Redis get operation failed, falling back to memory store", e);
    }
  }
  const item = memoryStore.get(key);
  if (item) {
    if (item.expiresAt > Date.now()) {
      return item.value;
    }
    memoryStore.delete(key);
  }
  return null;
}

export async function setLock(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<boolean> {
  if (redis) {
    try {
      const result = await redis.set(key, value, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch (e) {
      console.warn("Redis set operation failed, falling back to memory store", e);
    }
  }

  const existing = await getLock(key);
  if (existing) {
    return false;
  }

  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
  return true;
}

export async function releaseLock(key: string, value: string): Promise<boolean> {
  if (redis) {
    try {
      // Lua script to release lock atomically
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await redis.eval(script, 1, key, value);
      return result === 1;
    } catch (e) {
      console.warn("Redis delete operation failed, falling back to memory store", e);
    }
  }

  const item = memoryStore.get(key);
  if (item && item.value === value) {
    memoryStore.delete(key);
    return true;
  }
  return false;
}

export async function getAllLocks(prefix: string): Promise<Record<string, string>> {
  const locks: Record<string, string> = {};
  if (redis) {
    try {
      const keys = await redis.keys(`${prefix}*`);
      for (const key of keys) {
        const value = await redis.get(key);
        if (value) {
          locks[key] = value;
        }
      }
      return locks;
    } catch (e) {
      console.warn("Redis keys operation failed, falling back to memory store", e);
    }
  }

  const now = Date.now();
  for (const [key, item] of memoryStore.entries()) {
    if (key.startsWith(prefix) && item.expiresAt > now) {
      locks[key] = item.value;
    }
  }
  return locks;
}
