const fs = require('fs');
const path = require('path');

// Si el hosting tiene un disco persistente montado (ej. Render "Disks"),
// DATA_DIR apunta ahí para que la cache sobreviva a los redeploys. Sin esa
// variable, sigue usando la carpeta local de siempre.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function filePath(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readCache(name, fallback = null) {
  try {
    const raw = fs.readFileSync(filePath(name), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function writeCache(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf-8');
}

function cacheAge(name) {
  try {
    const stats = fs.statSync(filePath(name));
    return Date.now() - stats.mtimeMs;
  } catch (err) {
    return Infinity;
  }
}

module.exports = { readCache, writeCache, cacheAge };
