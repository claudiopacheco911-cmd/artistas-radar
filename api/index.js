// api/index.js
// Página de estado simple (para confirmar que el proyecto está desplegado).

export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><title>Radar de Artistas</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body{font-family:-apple-system,system-ui,sans-serif;max-width:640px;margin:60px auto;padding:0 20px;line-height:1.6;color:#1a1a1a}
  code{background:#f0f0f0;padding:2px 6px;border-radius:4px}
  .ok{color:#0a7d2c}
</style></head>
<body>
  <h1>🎭 Radar de Artistas</h1>
  <p class="ok">✓ El proyecto está desplegado y funcionando.</p>
  <p>Cada día (lunes a viernes) este agente descubre artistas vivos contemporáneos
     y te envía un reporte por Telegram.</p>
  <p>Para probarlo manualmente ahora mismo, visita:<br>
     <code>/api/cron?secret=TU_CRON_SECRET</code></p>
  <p>El cron está configurado en <code>vercel.json</code>.</p>
</body>
</html>`);
}
