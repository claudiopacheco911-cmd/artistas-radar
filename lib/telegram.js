// lib/telegram.js
// Formatea el reporte y lo envía por la Bot API de Telegram.

const TG_API = "https://api.telegram.org";
const MAX_LEN = 4000; // límite real de Telegram es 4096; dejamos margen.

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const PERFIL_EMOJI = {
  underground: "🔸",
  "media carrera": "🔹",
  consagrado: "⭐",
};

// Construye el bloque de texto (HTML) de un artista.
function formatArtist(a, index) {
  const emoji = PERFIL_EMOJI[a.perfil?.toLowerCase()] || "🎨";
  const lines = [];
  lines.push(
    `${emoji} <b>${index}. ${escapeHtml(a.nombre)}</b>`
  );

  const meta = [a.pais, a.disciplina, a.perfil].filter(Boolean).join(" · ");
  if (meta) lines.push(`<i>${escapeHtml(meta)}</i>`);

  if (a.bio) lines.push(escapeHtml(a.bio));

  if (a.destacado_reciente)
    lines.push(`📌 <b>Destacado:</b> ${escapeHtml(a.destacado_reciente)}`);

  if (a.web) lines.push(`🌐 <a href="${escapeHtml(a.web)}">Sitio web</a>`);

  const redes = a.redes || {};
  const redLinks = Object.entries(redes)
    .map(([k, v]) => {
      const label =
        { instagram: "Instagram", x: "X", facebook: "Facebook", youtube: "YouTube", tiktok: "TikTok", vimeo: "Vimeo", otra: "Más" }[
          k
        ] || k;
      return `<a href="${escapeHtml(v)}">${label}</a>`;
    })
    .join(" · ");
  if (redLinks) lines.push(`📱 ${redLinks}`);

  return lines.join("\n");
}

// Divide los artistas en mensajes que no excedan el límite de Telegram.
export function buildMessages(artistas, dateStr) {
  const header = `🎭 <b>Radar de Artistas</b> — ${escapeHtml(dateStr)}\n${artistas.length} artistas nuevos para tu base de datos:\n`;

  const chunks = [];
  let current = header;

  artistas.forEach((a, i) => {
    const block = "\n" + formatArtist(a, i + 1) + "\n";
    if ((current + block).length > MAX_LEN) {
      chunks.push(current);
      current = block;
    } else {
      current += block;
    }
  });
  if (current.trim()) chunks.push(current);
  return chunks;
}

async function sendOne(token, chatId, text) {
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(
      `Telegram API error: ${data.error_code} ${data.description || ""}`
    );
  }
  return data;
}

/**
 * Envía el reporte completo (posiblemente en varios mensajes).
 */
export async function sendReport({ token, chatId, artistas, dateStr }) {
  if (!token) throw new Error("Falta TELEGRAM_BOT_TOKEN");
  if (!chatId) throw new Error("Falta TELEGRAM_CHAT_ID");

  const messages = buildMessages(artistas, dateStr);
  const results = [];
  for (const m of messages) {
    results.push(await sendOne(token, chatId, m));
    // pequeña pausa para no chocar con rate limits
    await new Promise((r) => setTimeout(r, 400));
  }
  return results;
}

// Envía un mensaje simple de texto (para avisos de error, etc.).
export async function sendPlain({ token, chatId, text }) {
  return sendOne(token, chatId, escapeHtml(text));
}
