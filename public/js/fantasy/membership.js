function checkoutBanner() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'success') {
    return '<p class="state-msg">¡Pago recibido! Puede tardar unos segundos en activarse — recarga la página si no ves el cambio.</p>';
  }
  if (params.get('checkout') === 'cancel') {
    return '<p class="state-msg">Pago cancelado, no se te ha cobrado nada.</p>';
  }
  return '';
}

async function init() {
  if (!requireFantasyLogin()) return;
  const root = document.getElementById('membership-root');

  try {
    const { user } = await fantasyFetch('/api/fantasy/me');
    const banner = checkoutBanner();

    if (user.isPremium) {
      root.innerHTML = `
        ${banner}
        <div class="fantasy-card" style="max-width:420px">
          <h2>Ya eres miembro premium 🎉</h2>
          <p class="player-meta">No ves anuncios en la app.</p>
          <button class="pill fantasy-btn" id="portal-btn">Gestionar suscripción</button>
          <p class="error-msg" id="membership-error"></p>
        </div>
      `;
      document.getElementById('portal-btn').addEventListener('click', async () => {
        try {
          const { url } = await fantasyFetch('/api/fantasy/billing/portal', { method: 'POST' });
          window.location.href = url;
        } catch (err) {
          document.getElementById('membership-error').textContent = err.message;
        }
      });
    } else {
      root.innerHTML = `
        ${banner}
        <div class="fantasy-card" style="max-width:420px">
          <h2>Quita los anuncios</h2>
          <p class="player-meta">Suscripción mensual, cancelable cuando quieras desde "Gestionar suscripción".</p>
          <button class="pill fantasy-btn" id="checkout-btn">Suscribirme</button>
          <p class="error-msg" id="membership-error"></p>
        </div>
      `;
      document.getElementById('checkout-btn').addEventListener('click', async () => {
        try {
          const { url } = await fantasyFetch('/api/fantasy/billing/checkout', { method: 'POST' });
          window.location.href = url;
        } catch (err) {
          document.getElementById('membership-error').textContent = err.message;
        }
      });
    }
  } catch (err) {
    root.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

init();
