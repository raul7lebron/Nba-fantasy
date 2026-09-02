const FANTASY_TOKEN_KEY = 'fantasyToken';

function fantasyToken() {
  return localStorage.getItem(FANTASY_TOKEN_KEY);
}

function setFantasyToken(token) {
  if (token) localStorage.setItem(FANTASY_TOKEN_KEY, token);
  else localStorage.removeItem(FANTASY_TOKEN_KEY);
}

async function fantasyFetch(url, options = {}) {
  const token = fantasyToken();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de red');
  return data;
}

function fantasyFormatMoney(amount) {
  if (amount == null) return '$0';
  if (Math.abs(amount) >= 1_000_000) {
    return '$' + (amount / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + 'M';
  }
  return '$' + Math.round(amount).toLocaleString('es-ES');
}

function fantasyRatingColor(overall) {
  if (overall == null) return '#8993a8';
  if (overall >= 90) return '#3ecf6e';
  if (overall >= 80) return '#4c8dff';
  if (overall >= 70) return '#e8b93e';
  return '#8993a8';
}

function requireFantasyLogin() {
  if (!fantasyToken()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}
