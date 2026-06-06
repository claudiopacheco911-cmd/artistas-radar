// scripts/run-local.js
// Prueba local SIN gastar API: usa artistas de ejemplo y valida el formateo
// de mensajes de Telegram. Si defines las variables de entorno reales,
// también puede enviar de verdad (descomenta la sección al final).
//
// Uso:  node scripts/run-local.js

import { buildMessages } from "../lib/telegram.js";

const ejemplo = [
  {
    nombre: "Ejemplo Artista Underground",
    pais: "México",
    disciplina: "Arte de instalación, video",
    perfil: "underground",
    bio: "Artista emergente que trabaja con materiales reciclados para explorar la memoria urbana. Su obra ha aparecido en espacios independientes de Ciudad de México. Usa luz y sonido para crear ambientes inmersivos.",
    destacado_reciente: "Primera exposición individual en una galería independiente (2025).",
    web: "https://ejemplo-artista.com",
    redes: { instagram: "https://instagram.com/ejemplo", x: "https://x.com/ejemplo" },
  },
  {
    nombre: "Ejemplo Artista Consagrado",
    pais: "Sudáfrica",
    disciplina: "Pintura, grabado",
    perfil: "consagrado",
    bio: "Figura de renombre internacional cuya obra aborda la identidad post-apartheid. Ha expuesto en bienales de todo el mundo y forma parte de colecciones de museos importantes. Su estilo combina figuración y abstracción.",
    destacado_reciente: "Participó en la Bienal de Venecia (2024).",
    web: "",
    redes: { instagram: "https://instagram.com/ejemplo2", youtube: "https://youtube.com/@ejemplo2" },
  },
];

const dateStr = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date());

const msgs = buildMessages(ejemplo, dateStr);

console.log(`\n=== Se generaron ${msgs.length} mensaje(s) de Telegram ===\n`);
msgs.forEach((m, i) => {
  console.log(`----- Mensaje ${i + 1} (${m.length} caracteres) -----`);
  console.log(m);
  console.log();
});

// --- Envío real opcional (descomenta y exporta tus variables de entorno) ---
// import { sendReport } from "../lib/telegram.js";
// await sendReport({
//   token: process.env.TELEGRAM_BOT_TOKEN,
//   chatId: process.env.TELEGRAM_CHAT_ID,
//   artistas: ejemplo,
//   dateStr,
// });
// console.log("Enviado a Telegram.");

console.log("✓ Formateo OK. Si ves los mensajes arriba bien estructurados, el código funciona.");
