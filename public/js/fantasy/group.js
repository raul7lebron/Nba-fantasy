function getGroupId() {
  return new URLSearchParams(window.location.search).get('id');
}

let currentTab = 'market';
let cachedGroup = null;

async function loadGroup() {
  cachedGroup = await fantasyFetch(`/api/fantasy/groups/${getGroupId()}`);
  return cachedGroup;
}

async function loadMarket() {
  const res = await fetch('/api/fantasy/market');
  return res.json();
}

async function loadRoster() {
  return fantasyFetch(`/api/fantasy/groups/${getGroupId()}/roster`);
}

function renderHeader(group) {
  document.getElementById('group-header').innerHTML = `
    <a class="back-link" href="/index.html">&larr; Mis ligas</a>
    <h1>${group.name}</h1>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="pill">Código ${group.code}</span>
      <span class="pill">${group.members.length}/10 usuarios</span>
      <span class="pill">Presupuesto inicial ${fantasyFormatMoney(group.budget)}</span>
    </div>
  `;
}

function renderTabs() {
  document.getElementById('group-tabs').innerHTML = `
    <button class="pill fantasy-tab" data-tab="market">Mercado</button>
    <button class="pill fantasy-tab" data-tab="roster">Mi plantilla</button>
    <button class="pill fantasy-tab" data-tab="leaderboard">Clasificación</button>
  `;
  document.querySelectorAll('.fantasy-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  updateActiveTab();
}

function updateActiveTab() {
  document.querySelectorAll('.fantasy-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === currentTab);
  });
}

function playerCardHtml(p, actionHtml) {
  return `
    <div class="player-card" style="cursor:default;flex-direction:column;align-items:stretch;gap:8px">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <div>
          <div class="player-name">${p.first_name} ${p.last_name}</div>
          <div class="player-meta">${p.position || 'N/D'} · ${p.team ? p.team.abbreviation : '—'}</div>
        </div>
        ${p.rating2k ? `<span class="pill" style="color:${fantasyRatingColor(p.rating2k)};border-color:${fantasyRatingColor(p.rating2k)}66">${p.rating2k}</span>` : ''}
      </div>
      ${p.inactive ? '<span class="pill" style="color:#ff6b6b;border-color:#ff6b6b66">Ya no está en un equipo NBA (precio congelado)</span>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <strong style="color:var(--accent)">${fantasyFormatMoney(p.price)}</strong>
        ${actionHtml}
      </div>
    </div>
  `;
}

async function renderMarket() {
  const container = document.getElementById('group-content');
  const [group, market, roster] = await Promise.all([loadGroup(), loadMarket(), loadRoster()]);
  cachedGroup = group;

  if (!market.length) {
    container.innerHTML = '<p class="state-msg">Todavía no hay jugadores cacheados (hace falta esperar al primer refresco de plantillas).</p>';
    return;
  }

  const ownedSet = new Set((group.ownedPlayerIds || []).map(String));
  const myIds = new Set(roster.playerIds.map(String));
  const sorted = [...market].sort((a, b) => b.price - a.price);

  container.innerHTML = `
    <p class="subtitle">Dinero disponible: <strong style="color:var(--accent)">${fantasyFormatMoney(roster.money)}</strong></p>
    <div class="roster-grid">
      ${sorted.map((p) => {
        const isMine = myIds.has(String(p.id));
        const isTaken = ownedSet.has(String(p.id)) && !isMine;
        const action = isMine
          ? '<span class="pill">En tu plantilla</span>'
          : isTaken
            ? '<span class="pill">Fichado en la liga</span>'
            : `<button class="pill fantasy-btn" data-buy="${p.id}" style="cursor:pointer">Fichar</button>`;
        return playerCardHtml(p, action);
      }).join('')}
    </div>
  `;

  document.querySelectorAll('[data-buy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await fantasyFetch(`/api/fantasy/groups/${getGroupId()}/roster/buy`, {
          method: 'POST',
          body: JSON.stringify({ playerId: btn.dataset.buy })
        });
        await renderMarket();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderRosterTab() {
  const container = document.getElementById('group-content');
  const roster = await loadRoster();

  if (!roster.players.length) {
    container.innerHTML = `
      <p class="subtitle">Dinero disponible: <strong style="color:var(--accent)">${fantasyFormatMoney(roster.money)}</strong></p>
      <p class="state-msg">Todavía no has fichado a ningún jugador. Ve a la pestaña Mercado.</p>
    `;
    return;
  }

  container.innerHTML = `
    <p class="subtitle">
      Dinero disponible: <strong style="color:var(--accent)">${fantasyFormatMoney(roster.money)}</strong>
      · Valor de plantilla: <strong>${fantasyFormatMoney(roster.rosterValue)}</strong>
      · Valoración total conseguida: <strong>${(roster.totalValoracion || 0).toFixed(1)}</strong>
    </p>
    <div class="roster-grid">
      ${roster.players.map((p) => playerCardHtml(p, `<button class="pill fantasy-btn" data-sell="${p.id}" style="cursor:pointer">Vender</button>`)).join('')}
    </div>
  `;

  document.querySelectorAll('[data-sell]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Vender a este jugador al precio actual de mercado?')) return;
      try {
        await fantasyFetch(`/api/fantasy/groups/${getGroupId()}/roster/sell`, {
          method: 'POST',
          body: JSON.stringify({ playerId: btn.dataset.sell })
        });
        await renderRosterTab();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

async function renderLeaderboard() {
  const container = document.getElementById('group-content');
  const group = await loadGroup();

  container.innerHTML = `
    <div class="table-scroll">
      <table class="stats-table">
        <thead>
          <tr><th>#</th><th style="text-align:left">Usuario</th><th>Jugadores</th><th>Valor plantilla</th><th>Dinero</th><th>Valoración total</th></tr>
        </thead>
        <tbody>
          ${group.members.map((m, i) => `
            <tr>
              <td>${i + 1}</td>
              <td style="text-align:left">${m.username}</td>
              <td>${m.playerCount}</td>
              <td>${fantasyFormatMoney(m.rosterValue)}</td>
              <td>${fantasyFormatMoney(m.money)}</td>
              <td style="font-weight:700;color:var(--accent)">${(m.totalValoracion || 0).toFixed(1)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function switchTab(tab) {
  currentTab = tab;
  updateActiveTab();
  const container = document.getElementById('group-content');
  container.innerHTML = '<p class="state-msg">Cargando...</p>';
  try {
    if (tab === 'market') await renderMarket();
    else if (tab === 'roster') await renderRosterTab();
    else await renderLeaderboard();
  } catch (err) {
    container.innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

async function init() {
  if (!requireFantasyLogin()) return;
  if (!getGroupId()) {
    document.getElementById('group-header').innerHTML = '<p class="error-msg">Liga no especificada.</p>';
    return;
  }
  try {
    const group = await loadGroup();
    renderHeader(group);
    renderTabs();
    await switchTab('market');
  } catch (err) {
    document.getElementById('group-header').innerHTML = `<p class="error-msg">${err.message}</p>`;
  }
}

init();
