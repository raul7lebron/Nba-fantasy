// Rutas /api/fantasy/*: registro/login, ligas y plantillas del modo
// Fantasy. Ver README (sección "Modo Fantasy") para las reglas del juego.
const express = require('express');
const auth = require('./auth');
const groups = require('./groups');
const roster = require('./roster');
const market = require('./market');
const store = require('./store');

const router = express.Router();

router.post('/register', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = auth.registerUser(username, password);
    const token = auth.createSession(user.id);
    res.json({ token, user: auth.publicUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    const user = auth.verifyLogin(username, password);
    const token = auth.createSession(user.id);
    res.json({ token, user: auth.publicUser(user) });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.get('/me', auth.requireAuth, (req, res) => {
  res.json({ user: auth.publicUser(req.fantasyUser) });
});

router.get('/market', (req, res) => {
  res.json(market.getMarketPlayers());
});

router.get('/groups', auth.requireAuth, (req, res) => {
  res.json(groups.getGroupsForUser(req.fantasyUser.id));
});

router.post('/groups', auth.requireAuth, (req, res) => {
  try {
    const group = groups.createGroup(req.fantasyUser.id, req.body && req.body.name);
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/groups/join', auth.requireAuth, (req, res) => {
  try {
    const group = groups.joinGroup(req.fantasyUser.id, req.body && req.body.code);
    res.json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Adjunta a cada jugador de una plantilla su precio/equipo/valoracion 2K
// actuales, y calcula el valor total de la plantilla al precio de mercado
// de hoy (no lo que costó al ficharlo).
function enrichRoster(rosterData) {
  const marketPlayers = market.getMarketPlayers();
  const byId = new Map(marketPlayers.map((p) => [String(p.id), p]));
  const players = rosterData.playerIds.map((id) => byId.get(String(id))).filter(Boolean);
  const rosterValue = players.reduce((sum, p) => sum + p.price, 0);
  return { ...rosterData, players, rosterValue };
}

router.get('/groups/:id', auth.requireAuth, (req, res) => {
  try {
    const group = groups.getGroupById(req.params.id);
    groups.requireMembership(group, req.fantasyUser.id);

    const users = store.getUsers();
    const usersById = new Map(users.map((u) => [u.id, u]));
    const rosters = store.getRosters();
    const ownedPlayerIds = new Set();

    const members = group.memberIds.map((uid) => {
      const rosterData = rosters[`${group.id}:${uid}`] || { playerIds: [], money: group.budget, totalValoracion: 0 };
      rosterData.playerIds.forEach((id) => ownedPlayerIds.add(id));
      const enriched = enrichRoster(rosterData);
      const user = usersById.get(uid);
      return {
        userId: uid,
        username: user ? (user.displayName || user.username) : 'Usuario',
        playerCount: enriched.players.length,
        rosterValue: enriched.rosterValue,
        money: rosterData.money,
        totalValoracion: rosterData.totalValoracion || 0
      };
    }).sort((a, b) => b.totalValoracion - a.totalValoracion);

    res.json({ ...group, members, ownedPlayerIds: [...ownedPlayerIds] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/groups/:id/roster', auth.requireAuth, (req, res) => {
  try {
    const rosterData = roster.getRoster(req.params.id, req.fantasyUser.id);
    res.json(enrichRoster(rosterData));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/groups/:id/roster/buy', auth.requireAuth, (req, res) => {
  try {
    const rosterData = roster.buyPlayer(req.params.id, req.fantasyUser.id, req.body && req.body.playerId);
    res.json(enrichRoster(rosterData));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/groups/:id/roster/sell', auth.requireAuth, (req, res) => {
  try {
    const rosterData = roster.sellPlayer(req.params.id, req.fantasyUser.id, req.body && req.body.playerId);
    res.json(enrichRoster(rosterData));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
