import { describe, expect, it, vi } from "vitest";
import { connectWithRetry } from "../src/lib/db.js";

// Al arrancar, con una base que se duerme (Neon gratis), se reintenta unos segundos
// en vez de morir en la primera conexión fallida.

const down = new Error("Can't reach database server");

describe("connectWithRetry", () => {
  it("si conecta a la primera, no reintenta", async () => {
    const client = { $connect: vi.fn().mockResolvedValue(undefined) };
    const onRetry = vi.fn();
    await connectWithRetry(client, { delayMs: 1, onRetry });
    expect(client.$connect).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("reintenta hasta que la base despierta", async () => {
    const client = { $connect: vi.fn().mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(undefined) };
    const onRetry = vi.fn();
    await connectWithRetry(client, { delayMs: 1, onRetry });
    expect(client.$connect).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, down);
  });

  it("si no despierta, se rinde con el error original después de los intentos", async () => {
    const client = { $connect: vi.fn().mockRejectedValue(down) };
    await expect(connectWithRetry(client, { attempts: 3, delayMs: 1 })).rejects.toBe(down);
    expect(client.$connect).toHaveBeenCalledTimes(3);
  });

  it("espera más entre cada intento (2 s, 4 s, 6 s…)", async () => {
    vi.useFakeTimers();
    try {
      const client = { $connect: vi.fn().mockRejectedValueOnce(down).mockRejectedValueOnce(down).mockResolvedValue(undefined) };
      const done = connectWithRetry(client, { delayMs: 1000 });
      await vi.advanceTimersByTimeAsync(999);
      expect(client.$connect).toHaveBeenCalledTimes(1); // todavía en la primera espera (1 s)
      await vi.advanceTimersByTimeAsync(1);
      expect(client.$connect).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000); // segunda espera (2 s)
      await done;
      expect(client.$connect).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
