import request from "supertest";
import express, { Express } from "express";
import {
  createHealthRouter,
  checkDatabase,
  checkRedis,
  deriveOverallStatus,
  HealthResponseSchema,
} from "../../src/api/health";
import type { ServiceStatus } from "../../src/api/health";
import { PrismaClient } from "@prisma/client";
import { Redis } from "ioredis";

/** Helper: create a mock PrismaClient */
function createMockPrisma(shouldFail = false, errorMessage = "Connection refused"): PrismaClient {
  const mock = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaClient;

  if (shouldFail) {
    (mock.$queryRaw as jest.Mock).mockRejectedValue(new Error(errorMessage));
  } else {
    (mock.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
  }

  return mock;
}

/** Helper: create a mock Redis client */
function createMockRedis(shouldFail = false, errorMessage = "ECONNREFUSED"): Redis {
  const mock = {
    ping: jest.fn(),
  } as unknown as Redis;

  if (shouldFail) {
    (mock.ping as jest.Mock).mockRejectedValue(new Error(errorMessage));
  } else {
    (mock.ping as jest.Mock).mockResolvedValue("PONG");
  }

  return mock;
}

/** Helper: create an Express app with the health router */
function createApp(prisma: PrismaClient, redis: Redis, version?: string): Express {
  const app = express();
  app.use(createHealthRouter({ prisma, redis, version }));
  return app;
}

describe("GET /api/health", () => {
  describe("when all services are healthy", () => {
    let app: Express;

    beforeEach(() => {
      app = createApp(createMockPrisma(), createMockRedis(), "1.2.3");
    });

    it("returns 200 with healthy status", async () => {
      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("healthy");
      expect(res.body.version).toBe("1.2.3");
      expect(res.body.services.database.status).toBe("connected");
      expect(res.body.services.redis.status).toBe("connected");
    });

    it("returns a valid response matching the Zod schema", async () => {
      const res = await request(app).get("/api/health").expect(200);

      const result = HealthResponseSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });

    it("includes uptime as a non-negative number", async () => {
      const res = await request(app).get("/api/health").expect(200);

      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    });

    it("includes a valid ISO 8601 timestamp", async () => {
      const res = await request(app).get("/api/health").expect(200);

      expect(() => new Date(res.body.timestamp)).not.toThrow();
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    });

    it("includes latencyMs for each service", async () => {
      const res = await request(app).get("/api/health").expect(200);

      expect(typeof res.body.services.database.latencyMs).toBe("number");
      expect(typeof res.body.services.redis.latencyMs).toBe("number");
      expect(res.body.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res.body.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("when database is down", () => {
    let app: Express;

    beforeEach(() => {
      app = createApp(
        createMockPrisma(true, "ECONNREFUSED"),
        createMockRedis(),
        "1.2.3"
      );
    });

    it("returns 200 with degraded status", async () => {
      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("degraded");
      expect(res.body.services.database.status).toBe("disconnected");
      expect(res.body.services.database.error).toBe("ECONNREFUSED");
      expect(res.body.services.redis.status).toBe("connected");
    });
  });

  describe("when redis is down", () => {
    let app: Express;

    beforeEach(() => {
      app = createApp(
        createMockPrisma(),
        createMockRedis(true, "Redis connection lost"),
        "1.2.3"
      );
    });

    it("returns 200 with degraded status", async () => {
      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("degraded");
      expect(res.body.services.database.status).toBe("connected");
      expect(res.body.services.redis.status).toBe("disconnected");
      expect(res.body.services.redis.error).toBe("Redis connection lost");
    });
  });

  describe("when all services are down", () => {
    let app: Express;

    beforeEach(() => {
      app = createApp(
        createMockPrisma(true),
        createMockRedis(true),
        "1.2.3"
      );
    });

    it("returns 503 with unhealthy status", async () => {
      const res = await request(app).get("/api/health").expect(503);

      expect(res.body.status).toBe("unhealthy");
      expect(res.body.services.database.status).toBe("disconnected");
      expect(res.body.services.redis.status).toBe("disconnected");
    });

    it("still returns a schema-valid response", async () => {
      const res = await request(app).get("/api/health").expect(503);

      const result = HealthResponseSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe("default version", () => {
    it("uses 0.0.0 when no version is provided and env is unset", async () => {
      const originalEnv = process.env["APP_VERSION"];
      delete process.env["APP_VERSION"];

      const app = createApp(createMockPrisma(), createMockRedis());
      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.version).toBe("0.0.0");

      if (originalEnv !== undefined) {
        process.env["APP_VERSION"] = originalEnv;
      }
    });

    it("uses APP_VERSION env var when no version param is provided", async () => {
      const originalEnv = process.env["APP_VERSION"];
      process.env["APP_VERSION"] = "2.5.0";

      const app = createApp(createMockPrisma(), createMockRedis());
      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.version).toBe("2.5.0");

      if (originalEnv !== undefined) {
        process.env["APP_VERSION"] = originalEnv;
      } else {
        delete process.env["APP_VERSION"];
      }
    });
  });
});

describe("checkDatabase", () => {
  it("returns connected when query succeeds", async () => {
    const prisma = createMockPrisma();
    const result = await checkDatabase(prisma);

    expect(result.status).toBe("connected");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("returns disconnected with error message when query fails", async () => {
    const prisma = createMockPrisma(true, "timeout exceeded");
    const result = await checkDatabase(prisma);

    expect(result.status).toBe("disconnected");
    expect(result.error).toBe("timeout exceeded");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("handles non-Error thrown values", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue("string error"),
    } as unknown as PrismaClient;

    const result = await checkDatabase(prisma);

    expect(result.status).toBe("disconnected");
    expect(result.error).toBe("Unknown database error");
  });
});

describe("checkRedis", () => {
  it("returns connected when ping returns PONG", async () => {
    const redis = createMockRedis();
    const result = await checkRedis(redis);

    expect(result.status).toBe("connected");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("returns disconnected when ping fails", async () => {
    const redis = createMockRedis(true, "ECONNREFUSED");
    const result = await checkRedis(redis);

    expect(result.status).toBe("disconnected");
    expect(result.error).toBe("ECONNREFUSED");
  });

  it("returns disconnected when ping returns unexpected value", async () => {
    const redis = {
      ping: jest.fn().mockResolvedValue("NOT_PONG"),
    } as unknown as Redis;

    const result = await checkRedis(redis);

    expect(result.status).toBe("disconnected");
    expect(result.error).toContain("Unexpected PING response");
  });

  it("handles non-Error thrown values", async () => {
    const redis = {
      ping: jest.fn().mockRejectedValue(42),
    } as unknown as Redis;

    const result = await checkRedis(redis);

    expect(result.status).toBe("disconnected");
    expect(result.error).toBe("Unknown Redis error");
  });
});

describe("deriveOverallStatus", () => {
  it("returns healthy when all services are connected", () => {
    const services: Record<string, ServiceStatus> = {
      database: { status: "connected", latencyMs: 1 },
      redis: { status: "connected", latencyMs: 2 },
    };
    expect(deriveOverallStatus(services)).toBe("healthy");
  });

  it("returns degraded when some services are disconnected", () => {
    const services: Record<string, ServiceStatus> = {
      database: { status: "connected", latencyMs: 1 },
      redis: { status: "disconnected", latencyMs: 0, error: "down" },
    };
    expect(deriveOverallStatus(services)).toBe("degraded");
  });

  it("returns unhealthy when all services are disconnected", () => {
    const services: Record<string, ServiceStatus> = {
      database: { status: "disconnected", latencyMs: 0, error: "down" },
      redis: { status: "disconnected", latencyMs: 0, error: "down" },
    };
    expect(deriveOverallStatus(services)).toBe("unhealthy");
  });

  it("returns healthy for a single connected service", () => {
    const services: Record<string, ServiceStatus> = {
      database: { status: "connected", latencyMs: 5 },
    };
    expect(deriveOverallStatus(services)).toBe("healthy");
  });
});
