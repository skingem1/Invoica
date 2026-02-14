import express, { Express } from "express";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import {
  createHealthRouter,
  checkDatabase,
  checkRedis,
  deriveOverallStatus,
  HealthResponseSchema,
  ServiceStatusSchema,
} from "../../src/api/health";
import type { ServiceStatus } from "../../src/api/health";

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock("@prisma/client", () => {
  const mockPrisma = {
    $queryRaw: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

jest.mock("ioredis", () => {
  const mockRedis = {
    ping: jest.fn(),
  };
  return jest.fn(() => mockRedis);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildApp(
  prisma: PrismaClient,
  redis: Redis,
  version: string = "1.2.3"
): Express {
  const app = express();
  app.use(createHealthRouter({ prisma, redis, version }));
  return app;
}

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Health Check Endpoint", () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let app: Express;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
    redis = new (Redis as unknown as new () => Redis)();
    app = buildApp(prisma, redis);
  });

  // ── GET /api/health ──────────────────────────────────────────────────────

  describe("GET /api/health", () => {
    it("returns 200 with healthy status when all services are connected", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("healthy");
      expect(res.body.version).toBe("1.2.3");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.services.database.status).toBe("connected");
      expect(res.body.services.redis.status).toBe("connected");
      expect(res.body.services.database.error).toBeUndefined();
      expect(res.body.services.redis.error).toBeUndefined();

      // Validate against Zod schema
      const parsed = HealthResponseSchema.safeParse(res.body);
      expect(parsed.success).toBe(true);
    });

    it("returns 200 with degraded status when database is down but redis is up", async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error("Connection refused")
      );
      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("degraded");
      expect(res.body.services.database.status).toBe("disconnected");
      expect(res.body.services.database.error).toBe("Connection refused");
      expect(res.body.services.redis.status).toBe("connected");
    });

    it("returns 200 with degraded status when redis is down but database is up", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockRejectedValue(
        new Error("ECONNREFUSED")
      );

      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("degraded");
      expect(res.body.services.database.status).toBe("connected");
      expect(res.body.services.redis.status).toBe("disconnected");
      expect(res.body.services.redis.error).toBe("ECONNREFUSED");
    });

    it("returns 503 with unhealthy status when all services are down", async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error("DB unreachable")
      );
      (redis.ping as jest.Mock).mockRejectedValue(
        new Error("Redis unreachable")
      );

      const res = await request(app).get("/api/health").expect(503);

      expect(res.body.status).toBe("unhealthy");
      expect(res.body.services.database.status).toBe("disconnected");
      expect(res.body.services.redis.status).toBe("disconnected");
    });

    it("includes latency measurements for each service", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const res = await request(app).get("/api/health").expect(200);

      expect(typeof res.body.services.database.latencyMs).toBe("number");
      expect(res.body.services.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(typeof res.body.services.redis.latencyMs).toBe("number");
      expect(res.body.services.redis.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns valid ISO 8601 timestamp", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const res = await request(app).get("/api/health").expect(200);

      const parsed = Date.parse(res.body.timestamp);
      expect(isNaN(parsed)).toBe(false);
    });

    it("handles unexpected redis PING response", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockResolvedValue("UNEXPECTED");

      const res = await request(app).get("/api/health").expect(200);

      expect(res.body.status).toBe("degraded");
      expect(res.body.services.redis.status).toBe("disconnected");
      expect(res.body.services.redis.error).toContain("Unexpected PING response");
    });

    it("uses the version string passed via dependencies", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const customApp = buildApp(prisma, redis, "5.0.0-rc.1");
      const res = await request(customApp).get("/api/health").expect(200);

      expect(res.body.version).toBe("5.0.0-rc.1");
    });

    it("conforms to HealthResponseSchema for all status variants", async () => {
      // healthy
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);
      (redis.ping as jest.Mock).mockResolvedValue("PONG");
      let res = await request(app).get("/api/health");
      expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);

      // degraded
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error("fail"));
      res = await request(app).get("/api/health");
      expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);

      // unhealthy
      (redis.ping as jest.Mock).mockRejectedValue(new Error("fail"));
      res = await request(app).get("/api/health");
      expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);
    });
  });

  // ── Unit: checkDatabase ──────────────────────────────────────────────────

  describe("checkDatabase", () => {
    it("returns connected status on successful query", async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ "?column?": 1 }]);

      const result = await checkDatabase(prisma);

      expect(result.status).toBe("connected");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
      expect(ServiceStatusSchema.safeParse(result).success).toBe(true);
    });

    it("returns disconnected status on query failure", async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue(
        new Error("timeout")
      );

      const result = await checkDatabase(prisma);

      expect(result.status).toBe("disconnected");
      expect(result.error).toBe("timeout");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("handles non-Error thrown values gracefully", async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValue("string error");

      const result = await checkDatabase(prisma);

      expect(result.status).toBe("disconnected");
      expect(result.error).toBe("Unknown database error");
    });
  });

  // ── Unit: checkRedis ─────────────────────────────────────────────────────

  describe("checkRedis", () => {
    it("returns connected status on PONG response", async () => {
      (redis.ping as jest.Mock).mockResolvedValue("PONG");

      const result = await checkRedis(redis);

      expect(result.status).toBe("connected");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.error).toBeUndefined();
    });

    it("returns disconnected status on non-PONG response", async () => {
      (redis.ping as jest.Mock).mockResolvedValue("LOADING");

      const result = await checkRedis(redis);

      expect(result.status).toBe("disconnected");
      expect(result.error).toContain("Unexpected PING response");
    });

    it("returns disconnected status on ping failure", async () => {
      (redis.ping as jest.Mock).mockRejectedValue(
        new Error("ECONNREFUSED")
      );

      const result = await checkRedis(redis);

      expect(result.status).toBe("disconnected");
      expect(result.error).toBe("ECONNREFUSED");
    });

    it("handles non-Error thrown values gracefully", async () => {
      (redis.ping as jest.Mock).mockRejectedValue(42);

      const result = await checkRedis(redis);

      expect(result.status).toBe("disconnected");
      expect(result.error).toBe("Unknown Redis error");
    });
  });

  // ── Unit: deriveOverallStatus ────────────────────────────────────────────

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
        database: { status: "disconnected", latencyMs: 0, error: "down" },
        redis: { status: "connected", latencyMs: 2 },
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

    it("returns unhealthy for a single disconnected service", () => {
      const services: Record<string, ServiceStatus> = {
        database: { status: "disconnected", latencyMs: 0, error: "err" },
      };
      expect(deriveOverallStatus(services)).toBe("unhealthy");
    });
  });
});
