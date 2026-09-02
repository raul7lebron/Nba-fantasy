// Mercado del modo Fantasy: la lista de todos los jugadores activos (misma
// fuente que las plantillas normales, data/rosters.json) con su precio
// actual. El precio vive en fantasy_prices.json y se crea la primera vez
// que se pide un jugador, a partir de su valoración 2K; a partir de ahí
// solo lo mueve el ajuste por partidos (ver gameProcessor.js).
//
// Cada entrada de precio guarda ademas un "lastKnownInfo" (nombre, equipo,
// posicion, valoracion 2K) que se refresca mientras el jugador siga en una
// plantilla NBA activa. Si un jugador desaparece de las plantillas activas
// (cortado, retirado...) deja de salir en el mercado para fichar, pero esa
// foto congelada permite seguir mostrandolo y vendiendolo a quien ya lo
// tuviera fichado (ver getPlayerPriceEntry / roster.js).
const { readCache } = require('../cache');
const { normalizeName: normalize2kName } = require('../ratings2k');
const store = require('./store');
const { basePriceForRating } = require('./pricing');

function allActivePlayers() {
  const rosters = readCache('rosters', {});
  const teams = readCache('teams', []);
  const teamsById = new Map(teams.map((t) => [String(t.id), t]));
  const players = [];
  for (const [teamId, roster] of Object.entries(rosters)) {
    const team = teamsById.get(String(teamId));
    for (const p of roster) players.push({ ...p, team });
  }
  return players;
}

function ratingsByName() {
  const ratings = readCache('ratings2k', []).filter((r) => r.teamType === 'curr');
  return new Map(ratings.map((r) => [r.normalizedName, r]));
}

function ensurePrice(playerId, rating) {
  const prices = store.getPrices();
  const key = String(playerId);
  if (!prices[key]) {
    const base = basePriceForRating(rating);
    prices[key] = { basePrice: base, currentPrice: base, history: [] };
    store.savePrices(prices);
  }
  return prices[key];
}

function toMarketShape(p, rating, entry) {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    position: p.position,
    team: p.team ? { id: p.team.id, abbreviation: p.team.abbreviation, full_name: p.team.full_name } : null,
    rating2k: rating,
    price: entry.currentPrice,
    basePrice: entry.basePrice
  };
}

function getMarketPlayers() {
  const players = allActivePlayers();
  const ratings = ratingsByName();
  const prices = store.getPrices();
  let pricesChanged = false;

  const list = players.map((p) => {
    const fullName = `${p.first_name} ${p.last_name}`;
    const ratingMatch = ratings.get(normalize2kName(fullName));
    const rating = ratingMatch ? ratingMatch.overall : null;
    const key = String(p.id);

    let entry = prices[key];
    if (!entry) {
      const base = basePriceForRating(rating);
      entry = { basePrice: base, currentPrice: base, history: [] };
      prices[key] = entry;
      pricesChanged = true;
    }

    const shaped = toMarketShape(p, rating, entry);
    if (JSON.stringify(entry.lastKnownInfo) !== JSON.stringify(shaped)) {
      entry.lastKnownInfo = shaped;
      pricesChanged = true;
    }

    return shaped;
  });

  if (pricesChanged) store.savePrices(prices);
  return list;
}

function getPlayerMarketEntry(playerId) {
  return getMarketPlayers().find((p) => String(p.id) === String(playerId)) || null;
}

// A diferencia de getPlayerMarketEntry, esto NO exige que el jugador siga
// en una plantilla NBA activa: devuelve su precio actual (y su ultima
// foto conocida) aunque ya no se pueda fichar, para poder seguir
// mostrandolo/vendiendolo desde una plantilla que ya lo tenia.
function getFrozenPlayerEntry(playerId) {
  const prices = store.getPrices();
  const entry = prices[String(playerId)];
  if (!entry || !entry.lastKnownInfo) return null;
  return { ...entry.lastKnownInfo, price: entry.currentPrice, basePrice: entry.basePrice, inactive: true };
}

module.exports = {
  getMarketPlayers,
  getPlayerMarketEntry,
  getFrozenPlayerEntry,
  ensurePrice,
  allActivePlayers,
  ratingsByName
};
