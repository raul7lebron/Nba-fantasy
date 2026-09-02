// Anuncio interstitial cada 5 minutos de uso real de la app (solo cuenta
// mientras la pestaña está en primer plano) para usuarios sin membresía.
// El contador vive en localStorage para no reiniciarse al navegar entre
// páginas (index.html <-> group.html).
const AD_INTERVAL_MS = 5 * 60 * 1000;
const AD_ELAPSED_KEY = 'fantasyAdElapsedMs';
const AD_CLOSE_DELAY_S = 5;

function getAdElapsed() {
  return Number(localStorage.getItem(AD_ELAPSED_KEY) || 0);
}

function setAdElapsed(ms) {
  localStorage.setItem(AD_ELAPSED_KEY, String(ms));
}

// Huecos de anuncio de prueba: sustituye este bloque por el código real de
// tu red de anuncios (Google AdSense u otra) cuando tengas la cuenta lista.
function showAdInterstitial() {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal-box">
      <h2>Publicidad</h2>
      <div class="ad-slot-placeholder">Hueco de anuncio (300x250)</div>
      <button class="pill fantasy-btn" id="ad-close-btn" disabled>Cerrar (${AD_CLOSE_DELAY_S})</button>
      <p class="player-meta" style="margin-top:12px">
        <a href="/membership.html" style="color:var(--accent)">Quita los anuncios con la membresía &rarr;</a>
      </p>
    </div>
  `;
  document.body.appendChild(wrap);

  const closeBtn = wrap.querySelector('#ad-close-btn');
  let secondsLeft = AD_CLOSE_DELAY_S;
  const countdown = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      clearInterval(countdown);
      closeBtn.disabled = false;
      closeBtn.textContent = 'Cerrar';
    } else {
      closeBtn.textContent = `Cerrar (${secondsLeft})`;
    }
  }, 1000);

  closeBtn.addEventListener('click', () => wrap.remove());
}

function startAdTimer() {
  let lastTick = Date.now();
  setInterval(() => {
    const now = Date.now();
    if (document.visibilityState === 'visible') {
      const elapsed = getAdElapsed() + (now - lastTick);
      if (elapsed >= AD_INTERVAL_MS) {
        setAdElapsed(0);
        showAdInterstitial();
      } else {
        setAdElapsed(elapsed);
      }
    }
    lastTick = now;
  }, 1000);
}

async function initAds() {
  if (!fantasyToken()) return;
  try {
    const { user } = await fantasyFetch('/api/fantasy/me');
    if (user.isPremium) return;
  } catch (err) {
    return;
  }
  startAdTimer();
}

initAds();
