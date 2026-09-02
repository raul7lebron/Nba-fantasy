// Valoraciones NBA 2K via nba2kapi.com (API gratuita dedicada a esto).
// Necesita una API key gratuita: https://www.nba2kapi.com -> "Get an API key"
const BASE_URL = 'https://api.nba2kapi.com';

function getApiKey() {
  return process.env.NBA2KAPI_KEY || '';
}

function normalizeName(name) {
  return (name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/, '')
    .trim();
}

// Un solo endpoint trae TODA la liga de golpe: mucho mas barato que pedir
// jugador a jugador.
async function getAllPlayerRatings() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta NBA2KAPI_KEY. Copia .env.example a .env y añade tu clave gratuita de https://www.nba2kapi.com'
    );
  }

  const res = await fetch(`${BASE_URL}/api/players/bulk`, {
    headers: { 'X-API-Key': apiKey }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`nba2kapi /players/bulk -> HTTP ${res.status}: ${body}`);
  }
  const json = await res.json();
  const players = json.data || [];

  // El dataset incluye tambien cartas clasicas/de coleccion (teamType
  // "class"/"allt"), ademas de la carta de la plantilla vigente (teamType
  // "curr"), que es la unica que usa el modo Fantasy para fijar precios.
  return players.map((p) => ({
    name: p.name,
    normalizedName: normalizeName(p.name),
    overall: p.overall,
    tier: p.tier,
    teamType: p.teamType
  }));
}

module.exports = { getAllPlayerRatings, normalizeName };
