import "server-only";
import { createClient, type RedisClientType } from "redis";
import { getConfig } from "@/lib/config";

const globalRedis = globalThis as typeof globalThis & {
  redisClient?: RedisClientType;
  redisPromise?: Promise<RedisClientType>;
};

export async function redis(): Promise<RedisClientType> {
  if (globalRedis.redisClient?.isReady) return globalRedis.redisClient;
  globalRedis.redisPromise ??= (async () => {
    const client = createClient({ url: getConfig().REDIS_URL });
    client.on("error", (error) =>
      console.error(
        JSON.stringify({
          level: "error",
          event: "redis_error",
          message: error instanceof Error ? error.message : "unknown",
        }),
      ),
    );
    await client.connect();
    globalRedis.redisClient = client as RedisClientType;
    return globalRedis.redisClient;
  })();
  try {
    return await globalRedis.redisPromise;
  } finally {
    globalRedis.redisPromise = undefined;
  }
}
