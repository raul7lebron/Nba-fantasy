// Persistencia del modo Fantasy: JSON en disco (data/*.json / DATA_DIR).
// No hay base de datos real: para el tamaño de esta app (un puñado de
// ligas de hasta 10 usuarios) un JSON en disco es más que suficiente.
const crypto = require('crypto');
const { readCache, writeCache } = require('../cache');

function genId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function getUsers() { return readCache('fantasy_users', []); }
function saveUsers(users) { writeCache('fantasy_users', users); }

function getSessions() { return readCache('fantasy_sessions', {}); }
function saveSessions(sessions) { writeCache('fantasy_sessions', sessions); }

function getGroups() { return readCache('fantasy_groups', []); }
function saveGroups(groups) { writeCache('fantasy_groups', groups); }

function getRosters() { return readCache('fantasy_rosters', {}); }
function saveRosters(rosters) { writeCache('fantasy_rosters', rosters); }

function getPrices() { return readCache('fantasy_prices', {}); }
function savePrices(prices) { writeCache('fantasy_prices', prices); }

function getProcessedGames() { return readCache('fantasy_processed_games', []); }
function saveProcessedGames(ids) { writeCache('fantasy_processed_games', ids); }

function getEarningsLog() { return readCache('fantasy_earnings_log', []); }
function saveEarningsLog(log) { writeCache('fantasy_earnings_log', log); }

module.exports = {
  genId,
  getUsers, saveUsers,
  getSessions, saveSessions,
  getGroups, saveGroups,
  getRosters, saveRosters,
  getPrices, savePrices,
  getProcessedGames, saveProcessedGames,
  getEarningsLog, saveEarningsLog
};
