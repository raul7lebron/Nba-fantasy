require('dotenv').config();
const { readCache, writeCache } = require('./cache');
const { getAllTeams, getPlayersForTeam, getGamesForSeason, currentSeasonYear } = require('./balldontlie');
const { getAllPlayerRatings } = require('./ratings2k');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshTeamsAndRosters() {
  console.log('[refresh] descargando equipos...');
  const teams = await getAllTeams();
  writeCache('teams', teams);

  const rosters = readCache('rosters', {});
  for (const team of teams) {
    try {
      console.log(`[refresh] plantilla de ${team.full_name}...`);
      rosters[team.id] = await getPlayersForTeam(team.id);
      writeCache('rosters', rosters);
    } catch (err) {
      console.error(`[refresh] fallo plantilla equipo ${team.id}: ${err.message}`);
    }
    await sleep(2000);
  }
  console.log(`[refresh] ${teams.length} equipos y plantillas actualizados.`);
}

// Las valoraciones de NBA 2K se actualizan de vez en cuando (parches del
// juego), no hace falta refrescarlas a diario: se hace en el cron semanal.
async function refreshRatings2k() {
  console.log('[refresh] descargando valoraciones NBA 2K...');
  const ratings = await getAllPlayerRatings();
  writeCache('ratings2k', ratings);
  console.log(`[refresh] ${ratings.length} valoraciones 2K actualizadas.`);
}

// Los partidos de temporadas pasadas nunca cambian; solo la temporada en
// curso necesita refrescarse a diario, para que el modo Fantasy detecte los
// partidos recien terminados.
async function refreshCurrentSeasonGames() {
  const season = currentSeasonYear();
  console.log(`[refresh] descargando partidos de la temporada ${season}...`);
  const games = await getGamesForSeason(season);
  writeCache(`games_${season}`, games);
  console.log(`[refresh] ${games.length} partidos actualizados.`);
}

async function refreshAll() {
  await refreshTeamsAndRosters();
  await refreshCurrentSeasonGames();
  writeCache('meta', { lastFullRefresh: new Date().toISOString() });
}

if (require.main === module) {
  const mode = process.argv[2];
  const task =
    mode === 'ratings2k' ? refreshRatings2k() :
    mode === 'games' ? refreshCurrentSeasonGames() :
    refreshAll();
  task
    .then(() => {
      console.log('[refresh] completo.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[refresh] error fatal:', err);
      process.exit(1);
    });
}

module.exports = {
  refreshAll,
  refreshTeamsAndRosters,
  refreshRatings2k,
  refreshCurrentSeasonGames
};
