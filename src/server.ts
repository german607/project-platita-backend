import Fastify from "fastify";
import { ZodError } from "zod";
import { customerRoutes } from "./routes/customers.js";

const app = Fastify({ logger: true });

app.setErrorHandler((error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Datos inválidos", details: error.issues });
  }
  app.log.error(error);
  return reply.code(500).send({ error: "Error interno" });
});

app.get("/health", async () => ({ ok: true }));
app.register(customerRoutes);

const port = Number(process.env.PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
