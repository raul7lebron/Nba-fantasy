async function refreshMe() {
  if (!fantasyToken()) return null;
  try {
    const { user } = await fantasyFetch('/api/fantasy/me');
    return user;
  } catch (err) {
    setFantasyToken(null);
    return null;
  }
}

function renderAuthForms() {
  document.getElementById('fantasy-root').innerHTML = `
    <div class="page-head">
      <h1>NBA Fantasy</h1>
      <p class="subtitle">
        Ficha jugadores reales de la NBA con un presupuesto de ${fantasyFormatMoney(160_000_000)},
        compite en una liga de hasta 10 usuarios y gana dinero según la valoración que consigan
        tus jugadores partido a partido. El precio de cada jugador sube o baja solo, según cómo
        de bien o mal juegue.
      </p>
    </div>
    <div class="fantasy-auth-grid">
      <form id="login-form" class="fantasy-card">
        <h2>Entrar</h2>
        <label>Usuario<input name="username" required minlength="3" autocomplete="username"></label>
        <label>Contraseña<input name="password" type="password" required minlength="6" autocomplete="current-password"></label>
        <button class="pill fantasy-btn" type="submit">Entrar</button>
        <p class="error-msg" id="login-error"></p>
      </form>
      <form id="register-form" class="fantasy-card">
        <h2>Crear cuenta</h2>
        <label>Usuario<input name="username" required minlength="3" autocomplete="username"></label>
        <label>Contraseña<input name="password" type="password" required minlength="6" autocomplete="new-password"></label>
        <button class="pill fantasy-btn" type="submit">Crear cuenta</button>
        <p class="error-msg" id="register-error"></p>
      </form>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await fantasyFetch('/api/fantasy/login', {
        method: 'POST',
        body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
      });
      setFantasyToken(data.token);
      init();
    } catch (err) {
      document.getElementById('login-error').textContent = err.message;
    }
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const data = await fantasyFetch('/api/fantasy/register', {
        method: 'POST',
        body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') })
      });
      setFantasyToken(data.token);
      init();
    } catch (err) {
      document.getElementById('register-error').textContent = err.message;
    }
  });
}

async function loadGroups() {
  try {
    return await fantasyFetch('/api/fantasy/groups');
  } catch (err) {
    return [];
  }
}

function renderDashboard(user, groupsList) {
  const groupsHtml = groupsList.length
    ? `<div class="roster-grid">${groupsList.map((g) => `
        <a class="player-card" href="/group.html?id=${g.id}" style="flex-direction:column;align-items:flex-start;gap:6px">
          <div class="player-name">${g.name}</div>
          <div class="player-meta">${g.memberIds.length}/10 usuarios · código ${g.code}</div>
        </a>
      `).join('')}</div>`
    : '<p class="state-msg">Todavía no perteneces a ninguna liga. Crea una o únete con un código.</p>';

  document.getElementById('fantasy-root').innerHTML = `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div>
        <h1>Hola, ${user.displayName || user.username}</h1>
        <p class="subtitle">Gestiona tus ligas de NBA Fantasy</p>
      </div>
      <button class="pill" id="logout-btn" style="cursor:pointer">Cerrar sesión</button>
    </div>

    <div class="fantasy-auth-grid">
      <form id="create-group-form" class="fantasy-card">
        <h2>Crear liga</h2>
        <label>Nombre de la liga<input name="name" required minlength="3"></label>
        <button class="pill fantasy-btn" type="submit">Crear</button>
        <p class="error-msg" id="create-group-error"></p>
      </form>
      <form id="join-group-form" class="fantasy-card">
        <h2>Unirse a una liga</h2>
        <label>Código de invitación<input name="code" required minlength="4" maxlength="8" style="text-transform:uppercase"></label>
        <button class="pill fantasy-btn" type="submit">Unirse</button>
        <p class="error-msg" id="join-group-error"></p>
      </form>
    </div>

    <h3 style="margin-top:32px">Mis ligas</h3>
    ${groupsHtml}
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    setFantasyToken(null);
    init();
  });

  document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const group = await fantasyFetch('/api/fantasy/groups', {
        method: 'POST',
        body: JSON.stringify({ name: fd.get('name') })
      });
      window.location.href = `/group.html?id=${group.id}`;
    } catch (err) {
      document.getElementById('create-group-error').textContent = err.message;
    }
  });

  document.getElementById('join-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const group = await fantasyFetch('/api/fantasy/groups/join', {
        method: 'POST',
        body: JSON.stringify({ code: fd.get('code') })
      });
      window.location.href = `/group.html?id=${group.id}`;
    } catch (err) {
      document.getElementById('join-group-error').textContent = err.message;
    }
  });
}

async function init() {
  const user = await refreshMe();
  if (!user) {
    renderAuthForms();
    return;
  }
  const groupsList = await loadGroups();
  renderDashboard(user, groupsList);
}

init();
