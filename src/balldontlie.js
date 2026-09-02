// Cliente para la API publica https://www.balldontlie.io (v1). Solo trae
// los endpoints que necesita el modo Fantasy: equipos, plantillas activas,
// partidos de una temporada y el box score partido a partido.
// Necesita una API key gratuita: https://www.balldontlie.io -> Sign up -> My Account
const BASE_URL = 'https://api.balldontlie.io/v1';

function getApiKey() {
  return process.env.BALLDONTLIE_API_KEY || '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// El plan gratuito de balldontlie.io tiene un limite de peticiones por minuto
// muy bajo. Reintentamos con espera cuando responde 429.
async function bdlFetch(endpoint, retries = 5) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'Falta BALLDONTLIE_API_KEY. Copia .env.example a .env y añade tu clave gratuita de https://www.balldontlie.io'
    );
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    let res;
    try {
      res = await fetch(`${BASE_URL}${endpoint}`, {
        headers: { Authorization: apiKey }
      });
    } catch (networkErr) {
      if (attempt < retries) {
        await sleep(2000);
        continue;
      }
      throw networkErr;
    }

    if (res.status === 429 && attempt < retries) {
      const retryAfter = Number(res.headers.get('retry-after')) || 3;
      await sleep((retryAfter + 1) * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`balldontlie ${endpoint} -> HTTP ${res.status}: ${body}`);
    }
    return res.json();
  }
}

async function fetchAllPages(endpoint, maxPages = 5) {
  let cursor;
  let all = [];
  for (let i = 0; i < maxPages; i++) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = cursor ? `${endpoint}${sep}cursor=${cursor}` : endpoint;
    const json = await bdlFetch(url);
    all = all.concat(json.data || []);
    cursor = json.meta && json.meta.next_cursor;
    if (!cursor) break;
  }
  return all;
}

async function getAllTeams() {
  const teams = await fetchAllPages('/teams?per_page=100', 1);
  // balldontlie tambien devuelve equipos de otras ligas (Euroliga, NBL, CBA...);
  // los 30 equipos NBA son los unicos con conferencia East/West.
  return teams.filter((t) => ['East', 'West'].includes((t.conference || '').trim()));
}

async function getPlayersForTeam(teamId) {
  // /players devuelve el historial completo del equipo; /players/active (plan
  // ALL-STAR) filtra solo la plantilla vigente.
  return fetchAllPages(`/players/active?team_ids[]=${teamId}&per_page=100`, 3);
}

// Temporada NBA "actual": octubre-septiembre. Ej: en agosto 2026 la temporada
// vigente/mas reciente es la 2025 (2025-26), porque la 2026-27 empieza en octubre 2026.
function currentSeasonYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  return month >= 10 ? year : year - 1;
}

async function getGamesForSeason(season) {
  return fetchAllPages(`/games?seasons[]=${season}&per_page=100`, 20);
}

// Estadisticas partido a partido de una lista de partidos concretos (usado
// para calcular la valoracion de cada jugador tras cada jornada). Requiere
// el plan de pago ALL-STAR o superior.
async function getStatsForGameIds(gameIds) {
  if (!gameIds.length) return [];
  const query = gameIds.map((id) => `game_ids[]=${id}`).join('&');
  try {
    return await fetchAllPages(`/stats?${query}&per_page=100`, 20);
  } catch (err) {
    if (String(err.message).includes('401') || String(err.message).includes('403')) {
      return { error: 'PAID_TIER_REQUIRED' };
    }
    throw err;
  }
}

module.exports = {
  getAllTeams,
  getPlayersForTeam,
  getGamesForSeason,
  getStatsForGameIds,
  currentSeasonYear
};
