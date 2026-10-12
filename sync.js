/* Nudge sync: keeps reminders, lists and settings in one hidden file in the user's own Google Drive
   (appDataFolder). Phone app signs in with Google's device-code flow; Chrome uses Google sign-in (GIS).
   Merge is per record, latest edit wins, deletes are remembered as tombstones. */
(function () {
  'use strict';
  const CFG = {
    webClientId: '443976648544-h6t0k2oueeic17flf40mfne3dnh61do1.apps.googleusercontent.com',
    tvClientId: '443976648544-dr7bbig3q11nst1efnafu834s6d7017g.apps.googleusercontent.com',
    tvSecret: '__TV_SECRET__',
  };
  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE = 'nudge-sync.json';
  const LSK = 'nudge.sync.auth';
  const DAY = 86400000;

  /* ---------- pure merge (also used by tests) ---------- */
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  const byId = (a) => [...a].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  function sigOf(d) {
    const m = d.sync || {};
    return stable({ a: byId(d.alarms || []), i: byId(d.items || []), p: d.presets || [], s: d.settings || {}, u: m.u || {}, t: m.tomb || {}, ss: m.sets || 0, ps: m.pres || 0 });
  }
  function merge(L, R, now) {
    now = now || Date.now();
    const lm = L.sync || {}; const rm = R.sync || {};
    const lu = lm.u || {}; const ru = rm.u || {}; const lt = lm.tomb || {}; const rt = rm.tomb || {};
    const out = { alarms: [], items: [], u: {}, tomb: {} };
    ['alarms', 'items'].forEach((kind) => {
      const A = new Map((L[kind] || []).map((r) => [r.id, r])); const B = new Map((R[kind] || []).map((r) => [r.id, r]));
      new Set([...A.keys(), ...B.keys()]).forEach((id) => {
        const a = A.has(id) ? (lu[id] || 0) : -1; const b = B.has(id) ? (ru[id] || 0) : -1;
        const tb = Math.max(lt[id] || -1, rt[id] || -1); const best = Math.max(a, b);
        if (tb > 0 && tb >= best) { out.tomb[id] = tb; return; }
        out[kind].push(a >= b ? A.get(id) : B.get(id)); out.u[id] = best;
      });
    });
    [lt, rt].forEach((t) => Object.keys(t).forEach((id) => { if (!(id in out.u) && !(id in out.tomb)) out.tomb[id] = Math.max(lt[id] || 0, rt[id] || 0); }));
    Object.keys(out.tomb).forEach((id) => { if (now - out.tomb[id] > 60 * DAY) delete out.tomb[id]; });
    const lSet = lm.sets || 0; const rSet = rm.sets || 0; const lPre = lm.pres || 0; const rPre = rm.pres || 0;
    const settings = (rSet > lSet ? R.settings : L.settings) || {};
    const presets = (rPre > lPre ? R.presets : L.presets) || [];
    return { alarms: out.alarms, items: out.items, presets, settings, sync: { u: out.u, tomb: out.tomb, sets: Math.max(lSet, rSet), pres: Math.max(lPre, rPre) } };
  }

  /* ---------- host hooks + stamping ---------- */
  let H = null; let applying = false;
  let cache = new Map(); let lastS = ''; let lastP = '';
  const meta = (st) => st.sync || (st.sync = { u: {}, tomb: {}, sets: 0, pres: 0 });
  function snapshot(st) {
    cache = new Map(); [...st.alarms, ...st.items].forEach((r) => cache.set(r.id, JSON.stringify(r)));
    lastS = JSON.stringify(st.settings); lastP = JSON.stringify(st.presets);
  }
  function stamp(st) {
    const m = meta(st); const now = Date.now(); let changed = false; const seen = new Set();
    [...st.alarms, ...st.items].forEach((r) => {
      seen.add(r.id); const j = JSON.stringify(r);
      if (cache.get(r.id) !== j) { cache.set(r.id, j); m.u[r.id] = now; delete m.tomb[r.id]; changed = true; }
    });
    [...cache.keys()].forEach((id) => { if (!seen.has(id)) { cache.delete(id); delete m.u[id]; m.tomb[id] = now; changed = true; } });
    const s = JSON.stringify(st.settings); if (s !== lastS) { lastS = s; m.sets = now; changed = true; }
    const p = JSON.stringify(st.presets); if (p !== lastP) { lastP = p; m.pres = now; changed = true; }
    return changed;
  }
  const docOf = (st) => ({ v: 1, alarms: st.alarms, items: st.items, presets: st.presets, settings: st.settings, sync: meta(st) });
  function apply(m) {
    const st = H.state(); applying = true;
    try {
      st.alarms = m.alarms; st.items = m.items; st.presets = m.presets.length ? m.presets : st.presets;
      st.settings = { ...st.settings, ...m.settings }; st.sync = m.sync;
      const ids = new Set(m.alarms.map((a) => a.id)); st.pending = (st.pending || []).filter((p) => ids.has(p.alarmId));
      snapshot(st); H.save(); H.rerender();
    } finally { applying = false; }
  }

  /* ---------- auth ---------- */
  const isNative = () => !!(window.NativeBridge && window.NativeBridge.isNative);
  let auth = null; try { auth = JSON.parse(localStorage.getItem(LSK)); } catch (e) { auth = null; }
  const saveAuth = () => { try { if (auth) localStorage.setItem(LSK, JSON.stringify(auth)); else localStorage.removeItem(LSK); } catch (e) { /* ignore */ } };
  const ui = { state: auth ? 'idle' : 'off', msg: '', pair: null };
  const setUi = (s, msg, pair) => { ui.state = s; ui.msg = msg || ''; ui.pair = pair || null; if (H && H.onStatus) H.onStatus(); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const form = (url, o) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });

  let cancelPair = false;
  async function nativeConnect() {
    cancelPair = false;
    const r = await form('https://oauth2.googleapis.com/device/code', { client_id: CFG.tvClientId, scope: SCOPE });
    const d = await r.json();
    if (!d.device_code) throw new Error(d.error_description || d.error || 'Google would not start sign-in');
    setUi('pair', '', { code: d.user_code, url: d.verification_url || 'https://www.google.com/device' });
    const end = Date.now() + (d.expires_in || 1800) * 1000; let iv = (d.interval || 5) * 1000;
    while (Date.now() < end && !cancelPair) {
      await sleep(iv);
      const t = await (await form('https://oauth2.googleapis.com/token', { client_id: CFG.tvClientId, client_secret: CFG.tvSecret, device_code: d.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })).json();
      if (t.access_token) { auth = { mode: 'native', refresh: t.refresh_token, access: t.access_token, exp: Date.now() + (t.expires_in - 60) * 1000, fileId: null, last: 0 }; saveAuth(); return; }
      if (t.error === 'slow_down') iv += 5000; else if (t.error && t.error !== 'authorization_pending') throw new Error(t.error_description || t.error);
    }
    throw new Error(cancelPair ? 'Cancelled' : 'That code expired. Try again.');
  }
  function loadGsi() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts && google.accounts.oauth2) return res();
      const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = res; s.onerror = () => rej(new Error('Could not reach Google sign-in')); document.head.appendChild(s);
    });
  }
  function webToken(prompt) {
    return loadGsi().then(() => new Promise((res, rej) => {
      const c = google.accounts.oauth2.initTokenClient({
        client_id: CFG.webClientId, scope: SCOPE,
        callback: (r) => { if (r.error) return rej(new Error(r.error)); auth = { ...(auth || {}), mode: 'web', access: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 }; saveAuth(); res(auth.access); },
        error_callback: (e) => rej(new Error((e && e.type) || 'popup_blocked')),
      });
      c.requestAccessToken({ prompt });
    }));
  }
  async function token() {
    if (auth && auth.access && Date.now() < auth.exp) return auth.access;
    if (auth && auth.mode === 'native') {
      const t = await (await form('https://oauth2.googleapis.com/token', { client_id: CFG.tvClientId, client_secret: CFG.tvSecret, refresh_token: auth.refresh, grant_type: 'refresh_token' })).json();
      if (!t.access_token) { if (t.error === 'invalid_grant') { auth = null; saveAuth(); setUi('off', 'Google signed you out. Connect again.'); } throw new Error(t.error || 'refresh failed'); }
      auth.access = t.access_token; auth.exp = Date.now() + (t.expires_in - 60) * 1000; saveAuth(); return auth.access;
    }
    return webToken('none');
  }

  /* ---------- Drive ---------- */
  async function api(url, opts) {
    const t = await token(); opts = opts || {};
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } });
    if (r.status === 401) { auth.access = null; throw new Error('auth'); }
    if (!r.ok) throw new Error('Drive error ' + r.status);
    return r;
  }
  async function findFile() {
    const q = encodeURIComponent("name='" + FILE + "'");
    const j = await (await api('https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&orderBy=createdTime&fields=files(id)&q=' + q)).json();
    return (j.files && j.files[0]) || null;
  }
  const download = async (id) => (await api('https://www.googleapis.com/drive/v3/files/' + id + '?alt=media')).json();
  async function create(doc) {
    const b = 'nudgeboundary';
    const body = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) + '\r\n--' + b + '\r\nContent-Type: application/json\r\n\r\n' + JSON.stringify(doc) + '\r\n--' + b + '--';
    return (await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body })).json();
  }
  const update = (id, doc) => api('https://www.googleapis.com/upload/drive/v3/files/' + id + '?uploadType=media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc) });

  /* ---------- sync loop ---------- */
  let busy = false; let again = false; let timer = null; let looped = false;
  async function syncNow() {
    if (!auth || !H) return;
    if (busy) { again = true; return; }
    busy = true; if (ui.state !== 'pair') setUi('busy');
    try {
      const st = H.state(); if (stamp(st)) H.persist();
      const f = await findFile();
      if (!f) await create(docOf(st));
      else {
        const remote = await download(f.id); const local = docOf(st);
        const m = merge(local, remote); const ms = sigOf(m);
        if (ms !== sigOf(local)) apply(m);
        if (ms !== sigOf(remote)) await update(f.id, docOf(H.state()));
      }
      auth.last = Date.now(); saveAuth(); setUi('ok');
    } catch (e) {
      const msg = String(e.message || e);
      setUi(auth ? 'err' : 'off', /auth|none|popup|interaction|login/i.test(msg) ? 'Tap Reconnect to sign in again' : ui.state === 'off' ? ui.msg : 'Sync failed: ' + msg);
    } finally { busy = false; if (again) { again = false; schedule(1500); } }
  }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(syncNow, ms == null ? 3000 : ms); }

  const API = {
    cfg: CFG, merge, sigOf, stable, ui,
    get connected() { return !!auth; },
    get last() { return auth ? auth.last || 0 : 0; },
    init(host) {
      H = host; snapshot(H.state()); meta(H.state());
      if (auth) {
        setUi('idle'); schedule(1200);
        if (looped) return; looped = true;
        setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60000);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
        window.addEventListener('online', () => syncNow());
      }
    },
    onSave() { if (!auth || applying || !H) return; if (stamp(H.state())) schedule(); },
    async connect() {
      try {
        if (isNative()) await nativeConnect(); else await webToken('');
        auth.last = auth.last || 0; setUi('idle'); API.init(H); await syncNow();
      } catch (e) { setUi('off', String((e && e.message) || e)); }
    },
    cancel() { cancelPair = true; setUi(auth ? 'idle' : 'off'); },
    syncNow,
    disconnect() { auth = null; saveAuth(); setUi('off'); },
  };
  window.NudgeSync = API;
})();
