// lib/store.js
// Persistencia de los nombres ya enviados, para no repetir artistas.
//
// Estrategia en capas (usa la primera que esté configurada):
//   1) Vercel KV / Upstash Redis  -> si existe KV_REST_API_URL + KV_REST_API_TOKEN
//   2) GitHub Gist                -> si existe GIST_ID + GITHUB_TOKEN
//   3) Sin persistencia            -> funciona igual, pero podría repetir artistas
//                                     entre días (avisado en consola).
//
// Guardamos un JSON: { "names": ["Nombre 1", "Nombre 2", ...] }

const KEY = "artistas_radar_enviados";

// ---------- Capa 1: Vercel KV (REST de Upstash) ----------
function hasKV() {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function kvGet() {
  const url = `${process.env.KV_REST_API_URL}/get/${KEY}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  if (!data || !data.result) return [];
  try {
    const parsed = JSON.parse(data.result);
    return Array.isArray(parsed.names) ? parsed.names : [];
  } catch {
    return [];
  }
}

async function kvSet(names) {
  const url = `${process.env.KV_REST_API_URL}/set/${KEY}`;
  const value = JSON.stringify({ names });
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
}

// ---------- Capa 2: GitHub Gist ----------
function hasGist() {
  return !!(process.env.GIST_ID && process.env.GITHUB_TOKEN);
}

const GIST_FILE = "artistas-enviados.json";

async function gistGet() {
  const res = await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const file = data.files && data.files[GIST_FILE];
  if (!file || !file.content) return [];
  try {
    const parsed = JSON.parse(file.content);
    return Array.isArray(parsed.names) ? parsed.names : [];
  } catch {
    return [];
  }
}

async function gistSet(names) {
  await fetch(`https://api.github.com/gists/${process.env.GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify({ names }, null, 2) } },
    }),
  });
}

// ---------- API pública ----------

export async function getSentNames() {
  try {
    if (hasKV()) return await kvGet();
    if (hasGist()) return await gistGet();
  } catch (e) {
    console.warn("store.getSentNames falló, sigo sin exclusión:", e.message);
  }
  return [];
}

export async function addSentNames(newNames) {
  const clean = (newNames || []).map((n) => String(n).trim()).filter(Boolean);
  if (!clean.length) return;
  try {
    const existing = await getSentNames();
    const merged = Array.from(new Set([...existing, ...clean]));
    const capped = merged.slice(-1000);
    if (hasKV()) return await kvSet(capped);
    if (hasGist()) return await gistSet(capped);
    console.warn(
      "store: sin persistencia configurada (ni KV ni Gist). No se guardó el historial; podrían repetirse artistas."
    );
  } catch (e) {
    console.warn("store.addSentNames falló:", e.message);
  }
}

export function storageMode() {
  if (hasKV()) return "Vercel KV";
  if (hasGist()) return "GitHub Gist";
  return "ninguno (sin deduplicación persistente)";
}
