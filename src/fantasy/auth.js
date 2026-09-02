// Autenticación mínima del modo Fantasy: usuario/contraseña con hash
// bcrypt y sesiones por token (sin cookies ni JWT, para no meter más
// dependencias de las necesarias). El frontend guarda el token en
// localStorage y lo manda como "Authorization: Bearer <token>".
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const store = require('./store');

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function normalizeUsername(username) {
  return (username || '').trim().toLowerCase();
}

function registerUser(username, password) {
  const clean = normalizeUsername(username);
  if (clean.length < 3) throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
  if (!password || password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres');

  const users = store.getUsers();
  if (users.some((u) => u.username === clean)) {
    throw new Error('Ese nombre de usuario ya existe');
  }

  const user = {
    id: store.genId('user'),
    username: clean,
    displayName: (username || '').trim(),
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  users.push(user);
  store.saveUsers(users);
  return user;
}

function verifyLogin(username, password) {
  const clean = normalizeUsername(username);
  const users = store.getUsers();
  const user = users.find((u) => u.username === clean);
  if (!user || !bcrypt.compareSync(password || '', user.passwordHash)) {
    throw new Error('Usuario o contraseña incorrectos');
  }
  return user;
}

function createSession(userId) {
  const sessions = store.getSessions();
  const token = crypto.randomBytes(24).toString('hex');
  sessions[token] = { userId, expiresAt: Date.now() + SESSION_TTL_MS };
  store.saveSessions(sessions);
  return token;
}

function getUserFromToken(token) {
  if (!token) return null;
  const sessions = store.getSessions();
  const session = sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  const users = store.getUsers();
  return users.find((u) => u.id === session.userId) || null;
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'No autenticado' });
  req.fantasyUser = user;
  next();
}

function publicUser(user) {
  return { id: user.id, username: user.username, displayName: user.displayName };
}

module.exports = { registerUser, verifyLogin, createSession, getUserFromToken, requireAuth, publicUser };
