// lib/discover.js
// Descubre artistas vivos contemporáneos usando la API de Google Gemini
// (capa GRATIS) con grounding de Google Search. Sin dependencias externas:
// usa fetch directo al endpoint REST.
//
// Devuelve un arreglo de objetos artista ya estructurados.

// Modelo de la capa gratuita con grounding de Google Search.
// Puedes cambiarlo con la variable de entorno GEMINI_MODEL.
const DEFAULT_MODEL = "gemini-2.5-flash";

// Disciplinas y regiones que rotamos para maximizar diversidad día a día.
const DISCIPLINES = [
  "pintura",
  "escultura",
  "fotografía",
  "arte de instalación",
  "arte digital / new media",
  "performance",
  "street art / muralismo",
  "videoarte",
  "arte textil",
  "cerámica / arte del fuego",
  "arte sonoro",
  "arte conceptual",
  "grabado / obra sobre papel",
  "arte de la tierra / land art",
];

const REGIONS = [
  "Latinoamérica",
  "Norteamérica",
  "Europa Occidental",
  "Europa del Este",
  "África",
  "Medio Oriente",
  "Sur de Asia",
  "Este de Asia",
  "Sudeste Asiático",
  "Oceanía",
  "el Caribe",
  "los países nórdicos",
];

// Mezcla de perfiles: el usuario quiere de todo (underground, renombre, premiados).
const PROFILES = [
  "emergente / underground, poco conocido pero con obra potente",
  "de media carrera con reconocimiento creciente",
  "consagrado de renombre internacional",
  "que recientemente ganó o participó en una bienal importante (Venecia, São Paulo, Documenta, Whitney, Sharjah, etc.)",
  "con una exhibición, premio o noticia relevante en los últimos 12 meses",
];

function pickRotating(arr, seed, count) {
  // Selección pseudo-aleatoria determinística por día para variar el foco.
  const out = [];
  const used = new Set();
  let i = seed % arr.length;
  while (out.length < Math.min(count, arr.length)) {
    if (!used.has(i)) {
      out.push(arr[i]);
      used.add(i);
    }
    i = (i + 7 + seed) % arr.length;
  }
  return out;
}

function buildPrompt({ count, daySeed, excludeNames }) {
  const disciplines = pickRotating(DISCIPLINES, daySeed, 5).join(", ");
  const regions = pickRotating(REGIONS, daySeed + 3, 5).join(", ");
  const profiles = PROFILES.join("; ");

  const exclusion =
    excludeNames && excludeNames.length
      ? `\n\nIMPORTANTE: NO incluyas a ninguno de estos artistas, ya fueron enviados antes:\n${excludeNames
          .slice(-300)
          .join(", ")}.`
      : "";

  return `Eres un curador de arte experto. Tu tarea es descubrir ${count} artistas VIVOS y contemporáneos (que estén vivos actualmente, no fallecidos) para nutrir una base de datos personal.

Usa la búsqueda de Google para verificar que cada artista exista, esté vivo, y que sus datos (web, redes, hitos) sean reales y actuales.

Hoy quiero MÁXIMA DIVERSIDAD. Busca artistas que cubran un abanico amplio:
- Disciplinas a priorizar hoy (pero no exclusivamente): ${disciplines}.
- Regiones / países a priorizar hoy: ${regions}.
- Mezcla de perfiles: incluye al menos uno de cada tipo si puedes: ${profiles}.

Prioriza artistas con algo notable reciente (bienales, premios, exposiciones, ferias) pero también incluye descubrimientos underground genuinos.

Para CADA artista entrega EXACTAMENTE estos campos:
- nombre: nombre completo del artista.
- pais: país de origen y/o donde reside.
- disciplina: su(s) medio(s) principal(es).
- perfil: una de estas etiquetas -> "underground" | "media carrera" | "consagrado".
- bio: 3 a 5 frases. Quién es, qué hace, por qué importa, su estilo o temas, y cualquier hito reciente (premio, bienal, exposición) con el año.
- destacado_reciente: una sola frase sobre lo más importante o reciente de su trayectoria (con año si aplica). Si no hay nada reciente, describe su obra más célebre.
- web: URL de su sitio web oficial si existe (o "" si no encuentras uno).
- redes: objeto con las redes donde se puede ver su obra. Incluye solo las que existan, como URLs completas: { "instagram": "", "x": "", "facebook": "", "youtube": "", "tiktok": "", "vimeo": "", "otra": "" }. Deja vacías las que no apliquen.

REQUISITO OBLIGATORIO: CADA artista DEBE tener al menos UN enlace donde se pueda ver su obra (su web oficial, su Instagram, o cualquier otra URL real: galería que lo representa, museo, perfil de Artsy, Wikipedia, etc.). Si para un artista no encuentras NINGÚN enlace verificable, NO lo incluyas y busca otro en su lugar. Usa el campo "otra" de redes para enlaces que no encajen en las demás categorías (galería, Artsy, Wikipedia, etc.). Nunca entregues un artista sin ningún enlace.

Responde ÚNICAMENTE con un objeto JSON válido. REGLAS ESTRICTAS DE FORMATO:
- NO uses bloques de código markdown (nada de comillas triples ni "json").
- NO incluyas marcas de citación como [cite: 4] o [cite_start] dentro del texto.
- NO agregues ningún texto antes ni después del JSON.
La forma debe ser EXACTAMENTE:
{ "artistas": [ { "nombre": "", "pais": "", "disciplina": "", "perfil": "", "bio": "", "destacado_reciente": "", "web": "", "redes": {} } ] }${exclusion}`;
}

// Intenta extraer el primer bloque JSON del texto del modelo.
// Robusto frente a: fences ```json, marcas de citación [cite: N] que
// inserta el grounding de Google, y texto extra antes/después.
function extractJson(text) {
  if (!text) return null;

  let t = String(text);

  // 1) Quita las marcas de citación del grounding: [cite: 4, 5], [cite_start], etc.
  t = t.replace(/\[cite[^\]]*\]/gi, "");
  t = t.replace(/\[cite_start\]/gi, "");

  // 2) Quita TODOS los fences de markdown (```json y ```), no solo el primero.
  t = t.replace(/```json/gi, "").replace(/```/g, "");

  // 3) Recorta al primer "{" y al último "}".
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  let slice = t.slice(start, end + 1);

  // 4) Intento directo.
  try {
    return JSON.parse(slice);
  } catch {
    // 5) Reparación suave: quita comas colgantes antes de } o ].
    try {
      const repaired = slice.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

// Une todo el texto devuelto por Gemini (puede venir en varias "parts").
function extractText(data) {
  try {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts
      .map((p) => (typeof p.text === "string" ? p.text : ""))
      .join("\n")
      .trim();
  } catch {
    return "";
  }
}

/**
 * Descubre artistas. Devuelve { artistas: [...] }.
 * @param {object} opts
 * @param {number} opts.count          Cuántos artistas pedir.
 * @param {string[]} opts.excludeNames Nombres ya enviados (para no repetir).
 * @param {string} opts.apiKey         GEMINI_API_KEY (de Google AI Studio, gratis).
 */
export async function discoverArtists({ count = 6, excludeNames = [], apiKey }) {
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const daySeed = Math.floor(Date.now() / 86_400_000); // cambia cada día
  const prompt = buildPrompt({ count, daySeed, excludeNames });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    // Grounding con Google Search (búsqueda web real, incluida en capa gratis).
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.9, // algo de variedad entre días
      maxOutputTokens: 8192,
      // Desactiva el "thinking" de Gemini 2.5: la respuesta es ~2x más rápida
      // (clave para caber en el límite de tiempo de las funciones de Vercel).
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  // Llama a Gemini con reintentos ante errores temporales (503 alta demanda,
  // 429 rate limit, 500). Espera incremental entre intentos.
  async function callGeminiWithRetry(maxRetries = 3) {
    let lastErr = "";
    for (let intento = 1; intento <= maxRetries; intento++) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (res.ok) return await res.json();

      lastErr = await res.text().catch(() => "");
      const temporal = res.status === 503 || res.status === 429 || res.status === 500;
      if (temporal && intento < maxRetries) {
        // Espera 2s, 4s, ... antes de reintentar.
        await new Promise((r) => setTimeout(r, 2000 * intento));
        continue;
      }
      throw new Error(`Gemini API error ${res.status}: ${lastErr.slice(0, 300)}`);
    }
    throw new Error(`Gemini no respondió tras ${maxRetries} intentos: ${lastErr.slice(0, 300)}`);
  }

  const data = await callGeminiWithRetry();
  const text = extractText(data);

  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.artistas)) {
    throw new Error(
      "No se pudo parsear la respuesta de Gemini como JSON de artistas. Texto recibido:\n" +
        text.slice(0, 800)
    );
  }

  // Normaliza/limpia.
  const artistas = parsed.artistas
    .filter((a) => a && a.nombre)
    .map((a) => ({
      nombre: String(a.nombre || "").trim(),
      pais: String(a.pais || "").trim(),
      disciplina: String(a.disciplina || "").trim(),
      perfil: String(a.perfil || "").trim(),
      bio: String(a.bio || "").trim(),
      destacado_reciente: String(a.destacado_reciente || "").trim(),
      web: String(a.web || "").trim(),
      redes:
        a.redes && typeof a.redes === "object"
          ? Object.fromEntries(
              Object.entries(a.redes)
                .filter(([, v]) => v && String(v).trim())
                .map(([k, v]) => [k, String(v).trim()])
            )
          : {},
    }))
    // REQUISITO DEL USUARIO: cada artista DEBE tener al menos un enlace
    // (web o alguna red). Descartamos los que no traigan ninguno.
    .filter((a) => {
      const tieneWeb = a.web && /^https?:\/\//i.test(a.web);
      const tieneRed = Object.values(a.redes).some(
        (v) => v && /^https?:\/\//i.test(v)
      );
      return tieneWeb || tieneRed;
    });

  return { artistas };
}

export { DISCIPLINES, REGIONS };
