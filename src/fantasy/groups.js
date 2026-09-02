// Ligas del modo Fantasy: grupos cerrados de hasta 10 usuarios que compiten
// entre ellos. Se entra a una liga con un código de invitación de 6
// caracteres generado al crearla.
const crypto = require('crypto');
const store = require('./store');

const MAX_MEMBERS = 10;
const DEFAULT_BUDGET = 160_000_000;

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6);
}

function initRoster(groupId, userId, budget) {
  const rosters = store.getRosters();
  const key = `${groupId}:${userId}`;
  if (!rosters[key]) {
    rosters[key] = {
      groupId,
      userId,
      playerIds: [],
      money: budget,
      totalValoracion: 0,
      createdAt: new Date().toISOString()
    };
    store.saveRosters(rosters);
  }
  return rosters[key];
}

function createGroup(ownerId, name) {
  const clean = (name || '').trim();
  if (clean.length < 3) throw new Error('El nombre de la liga debe tener al menos 3 caracteres');

  const groups = store.getGroups();
  let code;
  do { code = generateCode(); } while (groups.some((g) => g.code === code));

  const group = {
    id: store.genId('group'),
    name: clean,
    code,
    ownerId,
    memberIds: [ownerId],
    budget: DEFAULT_BUDGET,
    createdAt: new Date().toISOString()
  };
  groups.push(group);
  store.saveGroups(groups);
  initRoster(group.id, ownerId, group.budget);
  return group;
}

function joinGroup(userId, code) {
  const groups = store.getGroups();
  const group = groups.find((g) => g.code === (code || '').trim().toUpperCase());
  if (!group) throw new Error('Código de liga no válido');
  if (group.memberIds.includes(userId)) return group;
  if (group.memberIds.length >= MAX_MEMBERS) {
    throw new Error(`Esta liga ya tiene el máximo de ${MAX_MEMBERS} usuarios`);
  }
  group.memberIds.push(userId);
  store.saveGroups(groups);
  initRoster(group.id, userId, group.budget);
  return group;
}

function getGroupsForUser(userId) {
  return store.getGroups().filter((g) => g.memberIds.includes(userId));
}

function getGroupById(groupId) {
  return store.getGroups().find((g) => g.id === groupId) || null;
}

function requireMembership(group, userId) {
  if (!group || !group.memberIds.includes(userId)) {
    throw new Error('No perteneces a esta liga');
  }
}

module.exports = {
  MAX_MEMBERS,
  DEFAULT_BUDGET,
  createGroup,
  joinGroup,
  initRoster,
  getGroupsForUser,
  getGroupById,
  requireMembership
};
