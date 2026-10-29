import { describe, expect, it } from "vitest";
import { evaluateGuard } from "../scripts/lib/dev-guard.js";

// El freno de seguridad del seed y del reset: que no se pueda llenar ni vaciar una
// base real por error.

const LOCAL = "postgresql://platita:platita@localhost:5432/platita";
const NEON = "postgresql://user:secreto@ep-algo-123.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("freno de seguridad de db:seed y db:reset-seed", () => {
  it("con una base local y fuera de producción, sigue sin pedir nada", () => {
    const result = evaluateGuard({ nodeEnv: "development", databaseUrl: LOCAL, args: [] });
    expect(result).toEqual({ ok: true, remote: false, host: "localhost", database: "platita" });
  });

  it.each(["localhost", "127.0.0.1", "[::1]", "db"])("el host %s cuenta como local", (host) => {
    const result = evaluateGuard({ nodeEnv: "development", databaseUrl: `postgresql://u:p@${host}:5432/platita`, args: [] });
    expect(result.ok).toBe(true);
  });

  describe("en producción", () => {
    it("se niega siempre", () => {
      const result = evaluateGuard({ nodeEnv: "production", databaseUrl: LOCAL, args: [] });
      expect(result).toMatchObject({ ok: false });
    });

    it("se niega aunque se pase --yes (no hay forma de forzarlo)", () => {
      const result = evaluateGuard({ nodeEnv: "production", databaseUrl: NEON, args: ["--yes"] });
      expect(result.ok).toBe(false);
      expect((result as { message: string }).message).toContain("production");
    });
  });

  describe("con una base que no es local", () => {
    it("se niega sin confirmación y dice contra cuál iba a escribir, sin mostrar la contraseña", () => {
      const result = evaluateGuard({ nodeEnv: "development", databaseUrl: NEON, args: [] });
      expect(result.ok).toBe(false);
      const message = (result as { message: string }).message;
      expect(message).toContain("neondb");
      expect(message).toContain("ep-algo-123.us-east-2.aws.neon.tech");
      expect(message).toContain("--yes");
      expect(message).not.toContain("secreto");
    });

    it("sigue con --yes y avisa que es remota", () => {
      const result = evaluateGuard({ nodeEnv: "development", databaseUrl: NEON, args: ["--yes"] });
      expect(result).toEqual({ ok: true, remote: true, host: "ep-algo-123.us-east-2.aws.neon.tech", database: "neondb" });
    });

    it("otros argumentos no cuentan como confirmación", () => {
      const result = evaluateGuard({ nodeEnv: "development", databaseUrl: NEON, args: ["--force-remote", "yes"] });
      expect(result.ok).toBe(false);
    });
  });
});
