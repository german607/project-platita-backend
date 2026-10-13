import type { FastifyInstance } from "fastify";

// Consola de pruebas local: una sola página, sin dependencias ni build.
// Solo se registra fuera de producción (ver app.ts). Para agregar un
// endpoint a la página, sumarlo al arreglo ENDPOINTS del script de abajo.
export async function devConsoleRoutes(app: FastifyInstance) {
  app.get("/", async (_req, reply) => reply.redirect("/dev"));
  app.get("/dev", async (_req, reply) => reply.type("text/html; charset=utf-8").send(PAGE));
}

const PAGE = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Platita — consola de pruebas</title>
<style>
  :root { --bg:#f6f7f9; --card:#fff; --line:#d9dde3; --text:#1d2330; --mute:#667085; --accent:#0b6bcb; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#14171c; --card:#1c2027; --line:#323844; --text:#e8ebf0; --mute:#98a2b3; --accent:#5aa6f5; }
  }
  * { box-sizing: border-box; }
  body { margin:0; padding:16px; background:var(--bg); color:var(--text); font:14px/1.45 system-ui, sans-serif; }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size:20px; margin:0 0 4px; }
  h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--mute); margin:20px 0 8px; }
  .sub { color:var(--mute); margin:0 0 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:12px; }
  .vars { display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:8px; }
  label { display:block; font-size:12px; color:var(--mute); margin-bottom:2px; }
  input, textarea { width:100%; padding:6px 8px; border:1px solid var(--line); border-radius:6px;
    background:var(--bg); color:var(--text); font:13px ui-monospace, Menlo, monospace; }
  textarea { min-height:90px; resize:vertical; }
  .head { display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap; }
  .m { font:700 11px ui-monospace, monospace; padding:2px 6px; border-radius:4px; color:#fff; }
  .GET { background:#2e7d32; } .POST { background:#b26a00; } .PATCH { background:#6a4fb3; }
  .path { font:13px ui-monospace, Menlo, monospace; word-break:break-all; }
  .desc { color:var(--mute); margin:0 0 8px; }
  button { background:var(--accent); color:#fff; border:0; border-radius:6px; padding:7px 14px; font-size:13px; cursor:pointer; margin-top:8px; }
  pre { margin:8px 0 0; padding:8px; background:var(--bg); border:1px solid var(--line); border-radius:6px;
    overflow:auto; max-height:320px; font:12px ui-monospace, Menlo, monospace; white-space:pre-wrap; word-break:break-word; }
  .status { font:700 12px ui-monospace, monospace; margin-top:8px; }
  .ok { color:#2e7d32; } .bad { color:#c62828; }
</style>
</head>
<body>
<main>
  <h1>Platita — consola de pruebas</h1>
  <p class="sub">Solo desarrollo. Los endpoints están en orden de uso: creá un comercio, una regla, un cliente y después cargá y cobrá. Los IDs se completan solos cuando la respuesta trae uno. Montos de entrada en pesos; los de salida, en centésimos.</p>

  <div class="card">
    <div class="vars">
      <div><label for="v-merchantId">merchantId</label><input id="v-merchantId" placeholder="se completa al crear un comercio"></div>
      <div><label for="v-bonusRuleId">bonusRuleId</label><input id="v-bonusRuleId" placeholder="se completa al crear una regla"></div>
      <div><label for="v-customerId">customerId</label><input id="v-customerId" placeholder="se completa al crear un cliente"></div>
    </div>
  </div>

  <div id="list"></div>
</main>

<script>
// Cada endpoint: método, ruta con :parametros, descripción y, opcionalmente:
//   body     → cuerpo de ejemplo (JSON)
//   query    → query string de ejemplo
//   captures → nombre de la variable de arriba que se completa con data.id de la respuesta
//   section  → título de grupo (solo en el primero de cada grupo)
var ENDPOINTS = [
  { section: "General", method: "GET", path: "/health", desc: "Chequeo de vida." },

  { section: "Comercios", method: "POST", path: "/merchants", captures: "merchantId",
    desc: "Crea un comercio. plan: BASIC, PRO o MULTI.",
    body: { name: "Café de la Esquina", phone: "099123456", plan: "BASIC" } },
  { method: "GET", path: "/merchants", desc: "Lista comercios, del más nuevo al más viejo. Paginado: la respuesta trae nextCursor.",
    query: "limit=20" },
  { method: "GET", path: "/merchants/:merchantId", desc: "Un comercio." },
  { method: "PATCH", path: "/merchants/:merchantId", desc: "Edita campos sueltos del comercio (al menos uno).",
    body: { name: "Café de la Esquina (Pocitos)" } },

  { section: "Reglas de bonificación", method: "POST", path: "/merchants/:merchantId/bonus-rules", captures: "bonusRuleId",
    desc: "Cargando minTopUp pesos o más, recibe bonusAmount pesos de bono. Se aplica la regla activa de mayor mínimo.",
    body: { minTopUp: 2000, bonusAmount: 300, name: "Promo $2.000+", description: "Cargá $2.000 y llevate $300 de regalo" } },
  { method: "GET", path: "/merchants/:merchantId/bonus-rules",
    desc: "Reglas del comercio, de menor a mayor mínimo. Cada una trae timesUsed: cuántos bonos salieron de ella." },
  { method: "PATCH", path: "/bonus-rules/:bonusRuleId", desc: "Edita o desactiva una regla (no se borran). name y description aceptan null para borrarlos.",
    body: { active: false } },
  { method: "GET", path: "/merchants/:merchantId/bonus-preview",
    desc: "Vista previa: qué regla y cuánto bono daría una carga de amount pesos. No registra nada.",
    query: "amount=2500" },

  { section: "Clientes", method: "POST", path: "/merchants/:merchantId/customers", captures: "customerId",
    desc: "Busca o crea un cliente por teléfono. El teléfono se normaliza (099123456 = +59899123456). Devuelve el cliente con su saldo.",
    body: { phone: "099123456", name: "Cliente de prueba" } },
  { method: "GET", path: "/merchants/:merchantId/customers",
    desc: "Lista clientes con su saldo. search busca por nombre o teléfono en cualquier formato (099123456 encuentra a +59899123456; también parcial). phone filtra por teléfono exacto sin crear nada.",
    query: "limit=20" },
  { method: "GET", path: "/customers/:customerId", desc: "Un cliente con su saldo." },
  { method: "PATCH", path: "/customers/:customerId", desc: "Cambia el nombre del cliente.",
    body: { name: "Nuevo nombre" } },
  { method: "GET", path: "/customers/:customerId/balance", desc: "Saldo actual (en centésimos de peso)." },
  { method: "GET", path: "/merchants/:merchantId/inactive", desc: "Clientes sin visita en N días, para campañas. Paginado; cada uno con su saldo, y total cuenta todos los inactivos.",
    query: "days=60&limit=50" },

  { section: "Saldo (libro mayor)", method: "POST", path: "/customers/:customerId/topups", idempotent: true,
    desc: "Registra una carga (el comercio ya cobró) y aplica la bonificación. Devuelve el movimiento, el bono (o null) y el saldo. Con Idempotency-Key, reenviar no duplica.",
    body: { amount: 2000, paidWith: "efectivo" } },
  { method: "POST", path: "/customers/:customerId/charges", idempotent: true,
    desc: "Cobra descontando saldo. 422 INSUFFICIENT_BALANCE si no alcanza. Acepta Idempotency-Key.",
    body: { amount: 350, note: "Café + medialuna" } },
  { method: "POST", path: "/customers/:customerId/adjustments", idempotent: true,
    desc: "Corrección manual con signo (positivo suma, negativo resta). La nota es obligatoria. Acepta Idempotency-Key.",
    body: { amount: -50, note: "Corrección por cobro duplicado" } },
  { method: "GET", path: "/customers/:customerId/transactions",
    desc: "Movimientos del cliente, del más nuevo al más viejo. Filtro opcional type: TOPUP, BONUS, CHARGE, ADJUSTMENT.",
    query: "limit=20" },
  { method: "GET", path: "/merchants/:merchantId/transactions",
    desc: "Movimientos de todo el comercio, del más nuevo al más viejo, con nombre y teléfono del cliente. from (inclusivo) y to (exclusivo) son fechas ISO con offset; type es opcional.",
    query: "from=2026-10-13T00:00:00-03:00&to=2026-10-14T00:00:00-03:00&limit=50" }
];

var VARS = ["merchantId", "bonusRuleId", "customerId"];
var list = document.getElementById("list");

function getVar(name) { return document.getElementById("v-" + name).value.trim(); }
function setVar(name, value) {
  var box = document.getElementById("v-" + name);
  box.value = value;
  try { localStorage.setItem("platita-dev-" + name, value); } catch (e) { /* sin storage */ }
}

function pathVars(path) {
  return (path.match(/:(\\w+)/g) || []).map(function (p) { return p.slice(1); });
}

function fillPath(path) {
  return path.replace(/:(\\w+)/g, function (_m, name) { return encodeURIComponent(getVar(name)); });
}

function el(tag, cls, text) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

ENDPOINTS.forEach(function (ep) {
  if (ep.section) list.appendChild(el("h2", null, ep.section));

  var card = el("div", "card");
  var head = el("div", "head");
  head.appendChild(el("span", "m " + ep.method, ep.method));
  head.appendChild(el("span", "path", ep.path));
  card.appendChild(head);
  card.appendChild(el("p", "desc", ep.desc));

  var bodyBox = null, queryBox = null, keyBox = null;
  if (ep.idempotent) {
    card.appendChild(el("label", null, "Idempotency-Key (opcional): repetir la misma clave no vuelve a registrar el movimiento"));
    keyBox = el("input"); keyBox.placeholder = "ej. cobro-mesa-4-001"; card.appendChild(keyBox);
  }
  if (ep.query !== undefined) {
    card.appendChild(el("label", null, "query string"));
    queryBox = el("input"); queryBox.value = ep.query; card.appendChild(queryBox);
  }
  if (ep.body) {
    card.appendChild(el("label", null, "body (JSON)"));
    bodyBox = el("textarea"); bodyBox.value = JSON.stringify(ep.body, null, 2); card.appendChild(bodyBox);
  }

  var btn = el("button", null, "Enviar");
  var status = el("div", "status");
  var out = el("pre"); out.style.display = "none";
  card.appendChild(btn); card.appendChild(status); card.appendChild(out);

  btn.addEventListener("click", async function () {
    var missing = pathVars(ep.path).filter(function (name) { return !getVar(name); });
    if (missing.length) {
      status.className = "status bad";
      status.textContent = "Falta completar arriba: " + missing.join(", ");
      out.style.display = "none";
      return;
    }
    var url = fillPath(ep.path);
    if (queryBox && queryBox.value.trim()) url += "?" + queryBox.value.trim();
    var opts = { method: ep.method, headers: {} };
    if (keyBox && keyBox.value.trim()) opts.headers["idempotency-key"] = keyBox.value.trim();
    if (bodyBox) {
      opts.headers["content-type"] = "application/json";
      opts.body = bodyBox.value;
    }
    status.className = "status"; status.textContent = "Enviando…"; out.style.display = "none";
    var t0 = performance.now();
    try {
      var res = await fetch(url, opts);
      var text = await res.text();
      var data = null;
      try { data = JSON.parse(text); } catch (e) { /* no era JSON */ }
      status.className = "status " + (res.ok ? "ok" : "bad");
      status.textContent = ep.method + " " + url + " → " + res.status + " (" + Math.round(performance.now() - t0) + " ms)"
        + (res.headers.get("idempotent-replayed") ? " — REINTENTO: devolvió la respuesta guardada, no registró de nuevo" : "");
      out.textContent = data !== null ? JSON.stringify(data, null, 2) : text;
      out.style.display = "block";
      if (res.ok && ep.captures && data && typeof data === "object" && data.id) {
        setVar(ep.captures, data.id);
      }
    } catch (err) {
      status.className = "status bad";
      status.textContent = "No se pudo conectar: " + err.message;
    }
  });

  list.appendChild(card);
});

// Recuerda los IDs entre recargas (solo en este navegador).
VARS.forEach(function (name) {
  var box = document.getElementById("v-" + name);
  try { box.value = localStorage.getItem("platita-dev-" + name) || ""; } catch (e) { /* sin storage */ }
  box.addEventListener("input", function () {
    try { localStorage.setItem("platita-dev-" + name, box.value); } catch (e) { /* sin storage */ }
  });
});
</script>
</body>
</html>`;
