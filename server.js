require('dotenv').config();
const express = require('express');
const path = require('path');

const { readCache } = require('./src/cache');
const { refreshAll, refreshRatings2k } = require('./src/refreshAll');
const { startScheduler } = require('./src/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/fantasy', require('./src/fantasy/routes'));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, async () => {
  console.log(`NBA Fantasy en http://localhost:${PORT}`);
  startScheduler();

  const hasTeams = readCache('teams');
  if (!hasTeams) {
    console.log('[startup] no hay cache previa, lanzando primer refresco (equipos, plantillas, partidos)...');
    try {
      await refreshAll();
    } catch (err) {
      console.error(
        '[startup] no se pudo hacer el refresco inicial. Revisa tu BALLDONTLIE_API_KEY en .env'
      );
      console.error(err.message);
    }
  }

  if (!readCache('ratings2k')) {
    console.log('[startup] no hay cache de valoraciones 2K, lanzando refresco...');
    refreshRatings2k().catch((err) => console.error('[startup] fallo refresco de valoraciones 2K:', err.message));
  }
});
