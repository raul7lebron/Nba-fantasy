// Plantillas del modo Fantasy: fichar/vender jugadores dentro de una liga,
// respetando el presupuesto inicial y evitando que dos usuarios de la misma
// liga tengan al mismo jugador (como en cualquier liga fantasy real).
const store = require('./store');
const { getGroupById, requireMembership, initRoster } = require('./groups');
const { getPlayerMarketEntry } = require('./market');

const MAX_ROSTER_SIZE = 15;

function rosterKey(groupId, userId) {
  return `${groupId}:${userId}`;
}

function getRoster(groupId, userId) {
  const group = getGroupById(groupId);
  requireMembership(group, userId);
  const rosters = store.getRosters();
  return rosters[rosterKey(groupId, userId)] || initRoster(groupId, userId, group.budget);
}

function findOwnerInGroup(groupId, playerId) {
  const rosters = store.getRosters();
  for (const roster of Object.values(rosters)) {
    if (roster.groupId === groupId && roster.playerIds.includes(String(playerId))) {
      return roster.userId;
    }
  }
  return null;
}

function buyPlayer(groupId, userId, playerId) {
  const group = getGroupById(groupId);
  requireMembership(group, userId);
  if (!playerId) throw new Error('Falta el jugador a fichar');

  const player = getPlayerMarketEntry(playerId);
  if (!player) throw new Error('Jugador no encontrado en el mercado');

  const pid = String(playerId);
  if (findOwnerInGroup(group.id, pid)) {
    throw new Error('Ese jugador ya está fichado por otro usuario de esta liga');
  }

  const rosters = store.getRosters();
  const key = rosterKey(group.id, userId);
  const roster = rosters[key] || initRoster(group.id, userId, group.budget);

  if (roster.playerIds.length >= MAX_ROSTER_SIZE) {
    throw new Error(`Máximo ${MAX_ROSTER_SIZE} jugadores por plantilla`);
  }
  if (roster.money < player.price) {
    throw new Error('No tienes suficiente dinero para fichar a este jugador');
  }

  roster.money -= player.price;
  roster.playerIds.push(pid);
  rosters[key] = roster;
  store.saveRosters(rosters);
  return roster;
}

function sellPlayer(groupId, userId, playerId) {
  const group = getGroupById(groupId);
  requireMembership(group, userId);
  if (!playerId) throw new Error('Falta el jugador a vender');

  const pid = String(playerId);
  const rosters = store.getRosters();
  const key = rosterKey(group.id, userId);
  const roster = rosters[key];
  if (!roster || !roster.playerIds.includes(pid)) {
    throw new Error('No tienes a ese jugador en tu plantilla');
  }

  const player = getPlayerMarketEntry(pid);
  const sellPrice = player ? player.price : 0;

  roster.playerIds = roster.playerIds.filter((id) => id !== pid);
  roster.money += sellPrice;
  rosters[key] = roster;
  store.saveRosters(rosters);
  return roster;
}

module.exports = { MAX_ROSTER_SIZE, getRoster, buyPlayer, sellPlayer, findOwnerInGroup };
