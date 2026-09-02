const cron = require('node-cron');
const { refreshAll, refreshRatings2k, refreshCurrentSeasonGames } = require('./refreshAll');
const { processFinishedGames } = require('./fantasy/gameProcessor');

function startScheduler() {
  // Equipos, plantillas y partidos de la temporada en curso: todos los
  // dias a las 06:00 (el modo Fantasy necesita esto al dia para saber que
  // partidos ya terminaron).
  cron.schedule('0 6 * * *', () => {
    console.log('[cron] refresco diario completo');
    refreshAll().catch((err) => console.error('[cron] error refresco diario:', err));
  });

  // Valoraciones 2K: cambian con los parches del juego, no a diario.
  cron.schedule('0 7 * * 0', () => {
    console.log('[cron] refresco semanal de valoraciones 2K');
    refreshRatings2k().catch((err) => console.error('[cron] error refresco 2K:', err));
  });

  // Modo Fantasy: procesa los partidos recien terminados (ajusta precios y
  // reparte dinero) cada 2 horas.
  cron.schedule('0 */2 * * *', () => {
    console.log('[cron] procesando partidos para el modo Fantasy');
    processFinishedGames().catch((err) => console.error('[cron] error procesando fantasy:', err));
  });

  console.log('[cron] tareas programadas: refresco completo 06:00, 2K domingos 07:00, fantasy cada 2h');
}

module.exports = { startScheduler };
