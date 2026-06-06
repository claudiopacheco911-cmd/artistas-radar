// api/cron.js
// Endpoint que Vercel Cron invoca cada día (L-V). Orquesta:
//   1. Carga nombres ya enviados (para no repetir).
//   2. Descubre N artistas nuevos con Claude + búsqueda web.
//   3. Envía el reporte por Telegram.
//   4. Guarda los nombres enviados.
//
// También puedes invocarlo manualmente en el navegador para probar:
//   https://TU-PROYECTO.vercel.app/api/cron?secret=TU_CRON_SECRET

import { discoverArtists } from "../lib/discover.js";
import { sendReport, sendPlain } from "../lib/telegram.js";
import { getSentNames, addSentNames, storageMode } from "../lib/store.js";

function todayStr() {
  const fmt = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: process.env.DISPLAY_TZ || "America/New_York",
  });
  return fmt.format(new Date());
}

// Verifica que la petición venga de Vercel Cron o traiga el secreto correcto.
function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // si no configuraste secreto, no bloqueamos.

  // Vercel Cron envía: Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.authorization || req.headers.Authorization;
  if (auth === `Bearer ${secret}`) return true;

  // Permite también ?secret=... para pruebas manuales.
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.get("secret") === secret) return true;
  } catch {
    /* noop */
  }
  return false;
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const {
    GEMINI_API_KEY,
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    ARTISTS_PER_DAY,
  } = process.env;

  const count = Math.min(
    Math.max(parseInt(ARTISTS_PER_DAY || "6", 10) || 6, 1),
    8
  );

  const started = Date.now();
  try {
    const excludeNames = await getSentNames();

    const { artistas } = await discoverArtists({
      count,
      excludeNames,
      apiKey: GEMINI_API_KEY,
    });

    if (!artistas.length) {
      throw new Error("El descubrimiento devolvió 0 artistas.");
    }

    await sendReport({
      token: TELEGRAM_BOT_TOKEN,
      chatId: TELEGRAM_CHAT_ID,
      artistas,
      dateStr: todayStr(),
    });

    await addSentNames(artistas.map((a) => a.nombre));

    const payload = {
      ok: true,
      enviados: artistas.length,
      nombres: artistas.map((a) => a.nombre),
      almacenamiento: storageMode(),
      duracion_ms: Date.now() - started,
    };
    console.log("Reporte enviado:", JSON.stringify(payload));
    return res.status(200).json(payload);
  } catch (err) {
    console.error("Fallo en el cron:", err);
    // Intentamos avisarte por Telegram del error (best-effort).
    try {
      if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
        await sendPlain({
          token: TELEGRAM_BOT_TOKEN,
          chatId: TELEGRAM_CHAT_ID,
          text: `⚠️ Radar de Artistas falló hoy: ${err.message}`,
        });
      }
    } catch {
      /* noop */
    }
    return res.status(500).json({ ok: false, error: err.message });
  }
}
