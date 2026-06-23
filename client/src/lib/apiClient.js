const TOKEN_KEY = "parthsaarthi_token";
const USER_KEY  = "parthsaarthi_user";

// localStorage so the session survives tab close and browser restart.
// The JWT itself expires in 8h and is silently refreshed before that point.
export function getToken()       { return localStorage.getItem(TOKEN_KEY); }
export function getStoredUser()  { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; }
export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Decode JWT expiry from the payload without a library.
function tokenExpiresAt(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// Deduplication handle — if multiple concurrent requests all trigger a
// refresh at the same moment, only one HTTP call goes out.
let _refreshPromise = null;

async function silentRefresh(token) {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = fetch("/api/auth/refresh", {
    method:  "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      _refreshPromise = null;
      if (data?.token) {
        setSession(data.token, getStoredUser());
        return data.token;
      }
      return token;
    })
    .catch(() => { _refreshPromise = null; return token; });

  return _refreshPromise;
}

// Refresh proactively when within 60 minutes of expiry so in-flight
// multi-step flows (e.g. booking at the 7h-59m mark) never hit a 401.
async function getValidToken() {
  const token = getToken();
  if (!token) return null;
  const exp = tokenExpiresAt(token);
  if (exp && Date.now() > exp - 60 * 60 * 1000) {
    return silentRefresh(token);
  }
  return token;
}

export async function apiFetch(path, options = {}) {
  const token = await getValidToken();
  const headers = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    clearSession();
    window.location.hash = "#/login";
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err  = new Error(body.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.data   = body;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}
