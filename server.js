require('dotenv').config();
const express = require('express');
const path = require('path');

const { readCache } = require('./src/cache');
const { refreshAll, refreshRatings2k } = require('./src/refreshAll');
const { startScheduler } = require('./src/scheduler');
const billing = require('./src/fantasy/billing');

const app = express();
const PORT = process.env.PORT || 3000;

// El webhook de Stripe necesita el cuerpo de la petición sin parsear (para
// verificar la firma), así que se monta ANTES de express.json() con su
// propio parser en crudo.
app.post('/api/fantasy/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    await billing.handleWebhookEvent(req.body, req.headers['stripe-signature']);
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

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
