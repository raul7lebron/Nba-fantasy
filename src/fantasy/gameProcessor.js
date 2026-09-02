// Corazón "en vivo" del modo Fantasy: por cada partido de la temporada
// actual que ya haya terminado y no se haya procesado todavía, calcula la
// valoración de cada jugador, ajusta su precio de mercado y reparte dinero
// a los usuarios que lo tengan fichado en cualquier liga.
//
// Requiere el plan de pago ALL-STAR (o superior) de balldontlie.io, porque
// el box score partido a partido viene del endpoint /stats. Sin ese plan,
// esta función no falla: simplemente no hay datos que procesar y los
// precios/dinero se quedan como estaban (se avisa por consola, igual que el
// resto de la web hace con este mismo límite del plan gratuito).
require('dotenv').config();
const { readCache } = require('../cache');
const { getStatsForGameIds, currentSeasonYear } = require('../balldontlie');
const { normalizeName: normalize2kName } = require('../ratings2k');
const store = require('./store');
const { computeValoracionFromBoxScore, adjustPrice, moneyForValoracion } = require('./pricing');
const { ratingsByName, ensurePrice } = require('./market');

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function processFinishedGames() {
  const season = currentSeasonYear();
  const games = readCache(`games_${season}`, []);
  const processed = new Set(store.getProcessedGames());
  const finished = games.filter((g) => g.status_state === 'final' && !processed.has(g.id));

  if (!finished.length) {
    console.log('[fantasy] no hay partidos nuevos que procesar.');
    return { processedGames: 0, error: null };
  }

  const ratings = ratingsByName();
  const prices = store.getPrices();
  const rosters = store.getRosters();
  const earningsLog = store.getEarningsLog();

  let processedCount = 0;
  let sawPaidTierError = false;

  for (const batch of chunk(finished, 20)) {
    const stats = await getStatsForGameIds(batch.map((g) => g.id));
    if (stats && stats.error === 'PAID_TIER_REQUIRED') {
      sawPaidTierError = true;
      break;
    }

    const gameIdsWithData = new Set();
    for (const stat of stats) {
      if (!stat.player || !stat.game) continue;
      gameIdsWithData.add(stat.game.id);

      const playerId = String(stat.player.id);
      const fullName = `${stat.player.first_name} ${stat.player.last_name}`;
      const ratingMatch = ratings.get(normalize2kName(fullName));
      const rating = ratingMatch ? ratingMatch.overall : null;

      const priceEntry = prices[playerId] || ensurePrice(playerId, rating);
      const valoracion = computeValoracionFromBoxScore(stat);
      const newPrice = adjustPrice(priceEntry.currentPrice, priceEntry.basePrice, rating, valoracion);

      priceEntry.currentPrice = newPrice;
      priceEntry.history = priceEntry.history || [];
      priceEntry.history.push({ gameId: stat.game.id, date: stat.game.date, valoracion, price: newPrice });
      if (priceEntry.history.length > 50) priceEntry.history = priceEntry.history.slice(-50);
      prices[playerId] = priceEntry;

      const earned = moneyForValoracion(valoracion);
      for (const roster of Object.values(rosters)) {
        if (!roster.playerIds.includes(playerId)) continue;
        roster.money += earned;
        roster.totalValoracion = (roster.totalValoracion || 0) + valoracion;
        earningsLog.push({
          gameId: stat.game.id,
          groupId: roster.groupId,
          userId: roster.userId,
          playerId,
          valoracion,
          earned,
          date: stat.game.date
        });
      }
    }

    for (const g of batch) {
      if (gameIdsWithData.has(g.id)) {
        processed.add(g.id);
        processedCount++;
      }
    }
  }

  store.savePrices(prices);
  store.saveRosters(rosters);
  store.saveProcessedGames([...processed]);
  if (earningsLog.length > 5000) earningsLog.splice(0, earningsLog.length - 5000);
  store.saveEarningsLog(earningsLog);

  console.log(`[fantasy] ${processedCount} partidos procesados.`);
  if (sawPaidTierError) {
    console.warn(
      '[fantasy] el endpoint /stats de balldontlie.io requiere el plan de pago ALL-STAR o superior; ' +
      'no se pudieron calcular valoraciones de partidos.'
    );
  }
  return { processedGames: processedCount, error: sawPaidTierError ? 'PAID_TIER_REQUIRED' : null };
}

if (require.main === module) {
  processFinishedGames()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[fantasy] error fatal procesando partidos:', err);
      process.exit(1);
    });
}

module.exports = { processFinishedGames };
