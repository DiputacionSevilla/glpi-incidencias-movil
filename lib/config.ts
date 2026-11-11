import "server-only";
import { z } from "zod";

const schema = z
  .object({
    GLPI_BASE_URL: z.string().url(),
    GLPI_APP_TOKEN: z.string().optional(),
    GLPI_ALLOW_HTTP: z.enum(["true", "false"]).default("false"),
    GLPI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    GLPI_CLOSE_STRATEGY: z
      .enum(["disabled", "solution", "status-solved", "status-closed"])
      .default("status-closed"),
    REDIS_URL: z.string().url().default("redis://localhost:6379"),
    SESSION_SECRET: z.string().min(32),
    SESSION_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
    SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(48).default(8),
    APP_ORIGIN: z
      .string()
      .refine(
        (value) =>
          value
            .split(",")
            .map((origin) => origin.trim())
            .filter(Boolean)
            .every((origin) => URL.canParse(origin)),
        "APP_ORIGIN debe contener origenes validos separados por comas",
      )
      .optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  })
  .superRefine((value, context) => {
    if (!value.GLPI_BASE_URL.startsWith("https://") && value.GLPI_ALLOW_HTTP !== "true") {
      context.addIssue({
        code: "custom",
        path: ["GLPI_BASE_URL"],
        message: "HTTP requiere GLPI_ALLOW_HTTP=true",
      });
    }
  });

export type Config = z.infer<typeof schema>;
let cached: Config | undefined;

export function getConfig(): Config {
  cached ??= schema.parse(process.env);
  return cached;
}
