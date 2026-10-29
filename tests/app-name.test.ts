import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./helpers.js";

// El nombre de la app (APP_NAME) sale de la configuración: la consola /dev y
// GET /auth/config lo usan, y se escapa para HTML.

const original = { ...process.env };
const opened: FastifyInstance[] = [];

async function appWith(env: Record<string, string>) {
  vi.resetModules();
  vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
  Object.assign(process.env, env);
  const { buildApp } = await import("../src/app.js");
  const app = await buildApp();
  await app.ready();
  opened.push(app);
  return app;
}

describe("nombre de la app", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    while (opened.length > 0) await opened.pop()!.close();
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  it("por defecto es Platita, en la consola y en /auth/config", async () => {
    const app = await appWith({});
    const page = await app.inject({ method: "GET", url: "/dev" });
    expect(page.body).toContain("<title>Platita — consola de pruebas</title>");
    expect(page.body).not.toContain("__APP_NAME__");
    expect((await api(app).get("/auth/config")).body.appName).toBe("Platita");
  });

  it("se puede cambiar con APP_NAME", async () => {
    const app = await appWith({ APP_NAME: "Ombú" });
    const page = await app.inject({ method: "GET", url: "/dev" });
    expect(page.body).toContain("<title>Ombú — consola de pruebas</title>");
    expect(page.body).toContain("<h1>Ombú — consola de pruebas</h1>");
    expect((await api(app).get("/auth/config")).body.appName).toBe("Ombú");
  });

  it("se escapa para HTML en la consola", async () => {
    const app = await appWith({ APP_NAME: "Ombú <x> & Co" });
    const page = await app.inject({ method: "GET", url: "/dev" });
    expect(page.body).toContain("Ombú &lt;x&gt; &amp; Co — consola de pruebas");
    expect(page.body).not.toContain("Ombú <x>");
  });
});
