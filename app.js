(() => {
  'use strict';
  const C = window.Core;
  const KEY = 'nudge.v1';
  const NEVER = 9e15; // "no ring scheduled"
  const COLORS = ['#00f0ff', '#ff2bd6', '#b6ff00', '#ff9f1a', '#a66bff', '#ffe600'];
  const NAGS = [5, 10, 15, 30, 60];
  // Reminder colours are stored as the original neon values (the identifiers); each palette maps them to the tones actually shown.
  const KEYS = { '#00f0ff': 'cyan', '#ff2bd6': 'pink', '#b6ff00': 'lime', '#ff9f1a': 'orange', '#a66bff': 'violet', '#ffe600': 'yellow' };
  const PALETTES = {
    soft:  { name: 'Soft',  light: { cyan: '#1f9d93', pink: '#cf5a82', lime: '#74a43c', orange: '#e0822b', violet: '#7b6bd6', yellow: '#d9a21b' }, btn: '#b4dc6a' },
    ocean: { name: 'Ocean', light: { cyan: '#12808a', pink: '#e0685a', lime: '#3aa57a', orange: '#ec8b3a', violet: '#5662c9', yellow: '#e0b030' }, btn: '#9bdcc0' },
    pastel: { name: 'Pastel', light: { cyan: '#5fb9b0', pink: '#e88fae', lime: '#9cc77a', orange: '#f0a666', violet: '#a597e6', yellow: '#e8c566' }, btn: '#cfe8b0' },
    dusk: { name: 'Dusk', light: { cyan: '#5b6fd6', pink: '#d4568f', lime: '#4fa38a', orange: '#e8803e', violet: '#8a56c9', yellow: '#e0a830' }, btn: '#c3c8f5' },
  };
  const lighten = (h, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) + (255 - parseInt(h.slice(i, i + 2), 16)) * t).toString(16).padStart(2, '0')).join('');
  const SHADE = { '#00f0ff': '#00a6c8', '#ff2bd6': '#e4169f', '#b6ff00': '#66b100', '#ff9f1a': '#f07a00', '#a66bff': '#7c4dff', '#ffe600': '#f0b400' };
  const palKey = () => (state && state.settings && PALETTES[state.settings.palette]) ? state.settings.palette : 'soft';
  const palColor = (k) => { const p = PALETTES[palKey()]; if (!p.light) return null; return isDark() ? lighten(p.light[k], 0.22) : p.light[k]; };
  const isDark = () => !!(state && state.settings && state.settings.dark);
  const cc = (c) => { const k = KEYS[String(c).toLowerCase()]; const pc = k && palColor(k); if (pc) return pc; return isDark() ? c : (SHADE[String(c).toLowerCase()] || c); };
  function applyTheme() {
    const d = isDark(); document.documentElement.dataset.theme = d ? 'dark' : 'light';
    const root = document.documentElement; const p = PALETTES[palKey()];
    ['cyan', 'pink', 'lime', 'orange', 'violet', 'yellow'].forEach((k) => { const v = p.light && k !== 'lime' ? palColor(k) : null; if (v) root.style.setProperty('--' + k, v); else root.style.removeProperty('--' + k); });
    if (p.btn) root.style.setProperty('--lime', p.btn); else root.style.removeProperty('--lime');
    root.style.setProperty('--li-op', ((state.settings.tagFill === undefined ? 14 : state.settings.tagFill)) + '%');
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = d ? '#000000' : '#fbfbfc';
  }
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const DAY_INITIAL = { 0: 'S', 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S' };

  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const ICON = {
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    archive: '<svg viewBox="0 0 24 24"><path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4"/></svg>',
    restore: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  };

  /* ================= state ================= */

  const defaults = () => ({
    v: 1,
    alarms: [],
    items: [],
    pending: [],
    presets: C.defaultPresets(),
    settings: { keepAwake: false, defaultNag: 10, defaultSound: 'pulse' },
    lastTick: Date.now(),
  });

  let state = load();
  applyTheme();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && Array.isArray(raw.alarms)) {
        const d = defaults();
        return { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) }, presets: raw.presets && raw.presets.length ? raw.presets : d.presets, pending: raw.pending || [], items: raw.items || [] };
      }
    } catch (e) { /* fall through */ }
    return defaults();
  }
  let lastSig = '';
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full / blocked */ }
    if (window.NudgeSync) window.NudgeSync.onSave();
    const NB = window.NativeBridge;
    if (NB && NB.isNative) {
      const sig = JSON.stringify([state.alarms, state.pending, state.presets]);
      if (sig !== lastSig) {
        lastSig = sig; NB.changed();
        if (document.visibilityState === 'visible') NB.clearDelivered();
      }
    }
  }

  /* ================= sounds (synthesised, no files) ================= */

  let actx = null;
  function audio() {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); }
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  function tone(c, o) {
    const { f, f2, t = 0, d = 0.2, type = 'sine', g = 0.25, a = 0.005 } = o;
    const osc = c.createOscillator(); const gain = c.createGain(); const t0 = c.currentTime + t;
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(g, t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(gain); gain.connect(c.destination);
    osc.start(t0); osc.stop(t0 + d + 0.05);
  }
  const SOUNDS = {
    pulse: { name: 'Pulse', len: 2.2, play: (c) => [0, 0.28, 0.56].forEach((t) => tone(c, { f: 880, t, d: 0.18, g: 0.22 })) },
    chime: { name: 'Chime', len: 3, play: (c) => { tone(c, { f: 1318.5, d: 1.6, g: 0.22 }); tone(c, { f: 1976, t: 0.02, d: 1.2, g: 0.1 }); tone(c, { f: 659, d: 2, g: 0.12 }); } },
    blip: { name: 'Blip', len: 2.2, play: (c) => [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, t: i * 0.1, d: 0.12, type: 'square', g: 0.07 })) },
    drop: { name: 'Drop', len: 2.2, play: (c) => { tone(c, { f: 1000, f2: 260, d: 0.5, g: 0.25 }); tone(c, { f: 1000, f2: 260, t: 0.7, d: 0.5, g: 0.15 }); } },
    pluck: { name: 'Pluck', len: 2.4, play: (c) => [523, 659, 784].forEach((f, i) => tone(c, { f, t: i * 0.18, d: 0.5, type: 'triangle', g: 0.28 })) },
    soft: { name: 'Soft', len: 3, play: (c) => { tone(c, { f: 523, d: 1.2, a: 0.25, g: 0.18 }); tone(c, { f: 659, t: 0.5, d: 1.4, a: 0.25, g: 0.18 }); } },
    beacon: { name: 'Beacon', len: 3, play: (c) => { tone(c, { f: 1200, d: 1.4, g: 0.22 }); tone(c, { f: 1200, t: 0.35, d: 1.2, g: 0.08 }); tone(c, { f: 1200, t: 0.7, d: 1, g: 0.04 }); } },
    none: { name: 'Vibrate only', len: 2.2, play: () => {} },
  };
  const soundOf = (k) => SOUNDS[k] || SOUNDS.pulse;

  function playOnce(key) {
    const c = audio(); const s = soundOf(key);
    if (c) { try { s.play(c); } catch (e) { /* ignore */ } }
  }

  let loopTimer = null; let loopStop = null;
  function startLoop(key) {
    stopLoop();
    const s = soundOf(key);
    const go = () => { playOnce(key); try { navigator.vibrate && navigator.vibrate([250, 120, 250, 120, 500]); } catch (e) { /* ignore */ } };
    go();
    loopTimer = setInterval(go, Math.max(2000, s.len * 1000 + 400));
    loopStop = setTimeout(stopLoop, 90000); // auto-silence after 90 s; reminder stays pending
  }
  function stopLoop() {
    clearInterval(loopTimer); clearTimeout(loopStop); loopTimer = loopStop = null;
    try { navigator.vibrate && navigator.vibrate(0); } catch (e) { /* ignore */ }
  }

  /* ================= notifications ================= */

  const isNative = () => !!(window.NativeBridge && window.NativeBridge.isNative);
  const canNotify = () => !isNative() && 'Notification' in window && Notification.permission === 'granted';
  async function askNotify() {
    if (isNative()) {
      const p = await window.NativeBridge.ensurePermissions();
      if (p.notif === 'denied') toast('Notifications are blocked. Allow them in Android settings.');
      return;
    }
    if (!('Notification' in window)) { toast('Notifications not supported here'); return; }
    if (Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) { /* ignore */ }
    }
    if (Notification.permission === 'denied') toast('Notifications are blocked in Chrome settings');
  }
  async function notify(p) {
    if (!canNotify() || !('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const first = state.presets[0];
      const actions = [{ action: 'done', title: 'Done' }];
      if (first) actions.push({ action: 'snooze', title: 'Snooze ' + C.presetLabel(first) });
      await reg.showNotification(p.label || 'Reminder', {
        body: C.hhmm(new Date(p.firedAt)) + (p.persistent ? ' · keeps ringing until Done' : ''),
        icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
        tag: 'p-' + p.id, renotify: true, requireInteraction: true,
        vibrate: [300, 150, 300, 150, 600], actions, data: { pid: p.id },
      });
    } catch (e) { /* ignore */ }
  }
  async function closeNotification(pid) {
    try {
      const reg = await navigator.serviceWorker.ready;
      (await reg.getNotifications({ tag: 'p-' + pid })).forEach((n) => n.close());
    } catch (e) { /* ignore */ }
  }

  /* ================= core actions ================= */

  const pendingById = (id) => state.pending.find((p) => p.id === id);

  function firePending(a, when, now) {
    const late = now - when.getTime();
    state.pending = state.pending.filter((p) => p.alarmId !== a.id);
    const missed = late > 10 * 60000 && !a.persistent;
    state.pending.push({
      id: uid(), alarmId: a.id, label: a.label, color: a.color, sound: a.sound,
      persistent: !!a.persistent, nag: a.nag || 10,
      firedAt: when.getTime(), nextRingAt: missed ? NEVER : now, mode: missed ? 'missed' : 'ring',
    });
  }

  function done(pid) {
    const pp = state.pending.find((p) => p.id === pid);
    const la = pp && state.alarms.find((x) => x.id === pp.alarmId);
    const li = la && la.listId && (state.items || []).find((x) => x.id === la.listId);
    if (li && !li.done) { li.done = true; li.doneAt = Date.now(); }
    state.pending = state.pending.filter((p) => p.id !== pid);
    closeNotification(pid); save(); afterChange();
  }
  function dismiss(pid) {
    const p = pendingById(pid); if (!p) return;
    if (p.persistent) {
      p.nextRingAt = Date.now() + p.nag * 60000; p.mode = 'nag';
      toast(`Rings again at ${C.hhmm(new Date(p.nextRingAt))}`);
      closeNotification(pid);
      save(); afterChange();
    } else done(pid);
  }
  function snoozeTo(pid, when) {
    const p = pendingById(pid); if (!p) return;
    if (!when || when.getTime() <= Date.now()) { toast('That time has already passed'); return; }
    p.nextRingAt = when.getTime(); p.mode = 'snooze';
    closeNotification(pid);
    toast('Snoozed until ' + C.fmtWhen(when));
    save(); afterChange();
  }
  function snoozePreset(pid, presetId) {
    const pr = state.presets.find((x) => x.id === presetId); if (!pr) return;
    const when = C.resolveSnooze(pr, new Date());
    if (!when) { toast('That snooze date has passed. Edit it in Settings.'); return; }
    snoozeTo(pid, when);
  }

  function handleExternalAction(action, pid) {
    if (!pid) return;
    if (action === 'done') done(pid);
    else if (action === 'snooze' && state.presets[0]) snoozePreset(pid, state.presets[0].id);
  }

  // A button on an Android notification was pressed (or the notification was tapped).
  function fromNotification(action, x) {
    x = x || {};
    tick(); // turns anything that fired while the app was closed into a pending item
    if (action === 'done' || action === 'snooze') {
      let p = x.pid ? pendingById(x.pid) : null;
      if (!p && x.alarmId) {
        p = state.pending.filter((q) => q.alarmId === x.alarmId)
          .sort((a, b) => Math.abs(a.firedAt - (x.firedAt || 0)) - Math.abs(b.firedAt - (x.firedAt || 0)))[0];
      }
      if (p) handleExternalAction(action, p.id);
    }
    afterChange();
  }

  /* ================= scheduler ================= */

  function tick() {
    const now = Date.now(); const nowD = new Date(now);
    let from = state.lastTick || now;
    if (from > now) from = now;
    if (now - from > 3 * 864e5) from = now - 3 * 864e5;
    let changed = false;
    for (const a of state.alarms) {
      if (!a.enabled) continue;
      const occ = C.occurrences(a, new Date(from), nowD);
      if (occ.length) {
        firePending(a, occ[occ.length - 1], now);
        if (!(a.days && a.days.length)) a.enabled = false; // one-off: used
        changed = true;
      }
    }
    state.lastTick = now; save();
    if (changed) renderMain();
    syncRing();
  }

  /* ================= ringing overlay ================= */

  const ringEl = $('#ring');
  let ringKey = ''; let ringCount = -1;

  function dueList() {
    const now = Date.now();
    return state.pending.filter((p) => p.nextRingAt <= now).sort((a, b) => a.nextRingAt - b.nextRingAt);
  }

  function syncRing() {
    const due = dueList();
    if (!due.length) {
      if (!ringEl.hidden) { ringEl.hidden = true; ringEl.innerHTML = ''; }
      stopLoop(); ringKey = ''; ringCount = -1; updateBadge();
      return;
    }
    const p = due[0]; const key = p.id + ':' + p.nextRingAt;
    if (key !== ringKey) {
      ringKey = key; ringCount = due.length;
      renderRing(p, due.length - 1);
      renderNeeds(); renderNext();
      startLoop(p.sound);
      notify(p);
    } else if (due.length !== ringCount) {
      ringCount = due.length; renderRing(p, due.length - 1);
    }
    updateBadge();
  }

  function snoozeGrid(pid) {
    const now = new Date();
    const btns = state.presets.map((pr) => {
      const when = C.resolveSnooze(pr, now);
      return `<button class="sn" data-action="snooze" data-pid="${pid}" data-preset="${pr.id}" ${when ? '' : 'disabled'}><b>${esc(C.presetLabel(pr))}</b><small>${when ? esc(C.fmtWhen(when, now)) : 'date passed'}</small></button>`;
    }).join('');
    const d = new Date(now.getTime() + 3600000); d.setMinutes(0, 0, 0);
    const val = `${C.ymd(d)}T${C.hhmm(d)}`;
    return `<div class="snooze-grid">${btns}</div>
      <button class="btn ghost" data-action="pickToggle" data-pid="${pid}">Pick a date &amp; time…</button>
      <div class="pickbox" id="pick-${pid}" hidden>
        <input type="datetime-local" id="pickval-${pid}" value="${val}">
        <button class="btn" data-action="pickSet" data-pid="${pid}">Snooze to this time</button>
      </div>`;
  }

  function renderRing(p, more) {
    const t = C.hhmm(new Date(p.firedAt));
    ringEl.hidden = false;
    ringEl.innerHTML = `<div class="ring-in" style="--c:${cc(p.color || COLORS[0])}">
      <div class="ring-top"><span class="pill">${p.mode === 'snooze' ? 'Snooze over' : p.mode === 'nag' ? 'Still waiting' : p.place ? 'Arrived · ' + esc(p.place) : 'Reminder'}</span>${more > 0 ? `<span class="pill alt">+${more} more</span>` : ''}</div>
      <div class="pulse"><i></i><i></i><b>${t}</b></div>
      <h2>${esc(p.label || 'Reminder')}</h2>
      ${p.persistent ? `<p class="sub2">Keeps ringing every ${p.nag} min until you tap Done</p>` : ''}
      <button class="btn big done" data-action="done" data-pid="${p.id}">Done ✓</button>
      <div class="snooze-h">Snooze until…</div>
      ${snoozeGrid(p.id)}
      <button class="link" data-action="dismiss" data-pid="${p.id}">${p.persistent ? `Dismiss · rings again in ${p.nag} min` : 'Dismiss'}</button>
    </div>`;
  }

  function updateBadge() {
    const n = state.pending.length;
    document.title = n ? `(${n}) Nudge` : 'Nudge';
    try { if (navigator.setAppBadge) { n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } } catch (e) { /* ignore */ }
  }

  /* ================= main screen ================= */

  function renderToday() {
    const d = new Date();
    $('#today').textContent = `${C.DAYS_FULL[d.getDay()]} ${d.getDate()} ${C.MONTHS[d.getMonth()]}`;
  }

  function pendingStatus(p) {
    const now = Date.now();
    if (p.nextRingAt <= now) return p.place ? 'Arrived · ' + p.place : 'Ringing now';
    if (p.mode === 'snooze') return 'Snoozed → ' + C.fmtWhen(new Date(p.nextRingAt));
    if (p.mode === 'nag') return 'Rings again ' + C.fmtWhen(new Date(p.nextRingAt));
    if (p.mode === 'missed') return 'Missed · ' + C.fmtWhen(new Date(p.firedAt));
    return '';
  }

  function renderNeeds() {
    const el = $('#needs');
    if (!state.pending.length) { el.innerHTML = ''; return; }
    const list = state.pending.slice().sort((a, b) => a.nextRingAt - b.nextRingAt);
    el.innerHTML = `<h3 class="sec-h hot">Needs you</h3>` + list.map((p) => `
      <article class="card pending" style="--c:${cc(p.color || COLORS[0])}">
        <div class="card-main" style="cursor:default">
          <div class="time">${C.hhmm(new Date(p.firedAt))}</div>
          <div class="meta"><div class="lbl">${esc(p.label || 'Reminder')}${p.persistent ? '<span class="tag">nags</span>' : ''}</div><div class="sub">${esc(pendingStatus(p))}</div></div>
        </div>
        <div class="acts">
          <button class="btn done" data-action="done" data-pid="${p.id}">Done ✓</button>
          <button class="btn ghost" data-action="snoozeSheet" data-pid="${p.id}">Snooze…</button>
        </div>
      </article>`).join('');
  }

  const isArchived = (a) => !!a.archived;
  let archOpen = false;
  let tagFilter = null;
  const cleanTag = (t) => String(t || '').toLowerCase().replace(/^#+/, '').trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '').slice(0, 20);
  function allTags() {
    const set = new Set(); state.alarms.forEach((x) => (x.tags || []).forEach((t) => set.add(t))); (state.items || []).forEach((x) => (x.tags || []).forEach((t) => set.add(t))); (state.settings.tagList || []).forEach((t) => set.add(t));
    return [...set].sort();
  }
  function alarmTags() {
    const set = new Set(); state.alarms.filter((x) => !x.listId).forEach((x) => (x.tags || []).forEach((t) => set.add(t)));
    return [...set].sort();
  }
  const hasTag = (a) => !tagFilter || (a.tags || []).includes(tagFilter);
  function recentPlaces() {
    const seen = new Map();
    state.alarms.forEach((x) => { if (x.loc) { const k = x.loc.lat.toFixed(4) + ',' + x.loc.lon.toFixed(4); if (!seen.has(k)) seen.set(k, x.loc); } });
    return [...seen.values()].slice(0, 6);
  }
  const subOf = (a) => a.loc
    ? `At ${a.loc.name || 'a place'} · ${a.loc.radius >= 1000 ? (a.loc.radius / 1000) + ' km' : a.loc.radius + ' m'}${a.locRepeat ? ' · every time' : ''}`
    : C.repeatLabel(a);

  function sortedAlarms() {
    const now = new Date();
    const clock = state.settings.sortMode === 'clock';
    const mins = (a) => { const m = /^(\d{1,2}):(\d{2})/.exec(a.time || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : 9999; };
    return state.alarms.filter((a) => !isArchived(a) && !a.listId).sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (clock && mins(a) !== mins(b)) return mins(a) - mins(b);
      const na = C.nextOccurrence(a, now); const nb = C.nextOccurrence(b, now);
      if (na && nb) return na - nb;
      if (na) return -1; if (nb) return 1;
      return (a.time || '~').localeCompare(b.time || '~');
    });
  }

  function archivedAlarms() {
    return state.alarms.filter((a) => isArchived(a) && !a.listId).sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0));
  }

  function renderList() {
    const el = $('#list');
    if (tagFilter && !alarmTags().includes(tagFilter)) tagFilter = null;
    const active = sortedAlarms().filter(hasTag); const arch = archivedAlarms().filter(hasTag);
    const tags = alarmTags();
    let html = tags.length
      ? `<div class="tagbar"><button class="chip ${tagFilter ? '' : 'on'}" data-action="tagFilter" data-tag="">All</button>${tags.map((t) => `<button class="chip ${tagFilter === t ? 'on' : ''}" data-action="tagFilter" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`
      : '';
    if (!active.length) {
      html += (arch.length || tagFilter)
        ? `<div class="empty"><b>${tagFilter ? 'Nothing tagged #' + esc(tagFilter) : 'Nothing active'}</b>Tap the + button to add a reminder.</div>`
        : `<div class="empty"><b>Nothing set yet</b>Tap the + button to add your first reminder.</div>`;
    } else {
      html += `<h3 class="sec-h row">Reminders <span class="hint">swipe right for options</span><button class="sortbtn" data-action="sortToggle" aria-label="Change sort order">${ICON.sort || '⇅'} ${state.settings.sortMode === 'clock' ? 'By time' : 'Next due'}</button></h3>` + active.map((a) => swipeRow(a, false)).join('');
    }
    if (arch.length) {
      html += `<button class="arch-h" data-action="toggleArchive" aria-expanded="${archOpen}"><span>Archived <b>${arch.length}</b></span><i class="${archOpen ? 'open' : ''}">${ICON.down}</i></button>`;
      if (archOpen) html += `<div class="arch-list"><p class="hint" style="margin:0 2px 8px;display:block">swipe right to reactivate or delete</p>` + arch.map((a) => swipeRow(a, true)).join('') + `</div>`;
    }
    el.innerHTML = html;
  }

  const dayCount = (a) => {
    if (a.loc || !a.enabled || a.archived) return '';
    const now = new Date(); const nx = C.nextOccurrence(a, now); if (!nx) return '';
    const n = Math.round((new Date(nx.getFullYear(), nx.getMonth(), nx.getDate()) - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    return n <= 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'in ' + n + ' days';
  };
  const timeCell = (a) => {
    if (a.loc) return `<div class="time pin">${ICON.pin}</div>`;
    const cd = dayCount(a);
    return cd ? `<div class="tcol"><div class="time">${esc(a.time)}</div><div class="cd">${cd}</div></div>` : `<div class="time">${esc(a.time)}</div>`;
  };
  // Time entry: any minute, 24h. Two numeric boxes feeding a hidden input (so .value still works).
  const timeField = (id, v) => {
    const [h, m] = String(v || '09:00').split(':');
    return `<div class="tin"><input class="t-h" inputmode="numeric" maxlength="2" value="${esc(h)}" aria-label="Hour"><b>:</b><input class="t-m" inputmode="numeric" maxlength="2" value="${esc(m)}" aria-label="Minute"><input type="hidden" id="${id}" value="${esc(h + ':' + m)}"></div>`;
  };
  (() => {
    const pad = (n) => String(n).padStart(2, '0');
    const sync = (box, fix) => {
      const hh = box.querySelector('.t-h'); const mm = box.querySelector('.t-m');
      if (fix) {
        hh.value = pad(Math.min(23, Math.max(0, parseInt(hh.value, 10) || 0)));
        mm.value = pad(Math.min(59, Math.max(0, parseInt(mm.value, 10) || 0)));
      }
      box.querySelector('input[type=hidden]').value = pad(Math.min(23, parseInt(hh.value, 10) || 0)) + ':' + pad(Math.min(59, parseInt(mm.value, 10) || 0));
    };
    document.addEventListener('focusin', (e) => { if (e.target.closest && e.target.closest('.tin') && e.target.matches('.t-h,.t-m')) e.target.select(); });
    document.addEventListener('input', (e) => {
      const t = e.target; const box = t.closest && t.closest('.tin'); if (!box || !t.matches('.t-h,.t-m')) return;
      t.value = t.value.replace(/\D/g, '').slice(0, 2); sync(box, false);
      if (t.classList.contains('t-h') && (t.value.length === 2 || Number(t.value) > 2)) { t.value = pad(Number(t.value)); sync(box, false); box.querySelector('.t-m').focus(); }
      else if (t.classList.contains('t-m') && (t.value.length === 2 || Number(t.value) > 5)) { t.value = pad(Number(t.value)); sync(box, false); t.blur(); }
    });
    document.addEventListener('focusout', (e) => { const t = e.target; const box = t.closest && t.closest('.tin'); if (box && t.matches('.t-h,.t-m')) sync(box, true); });
  })();

  const det = () => Object.assign({ repeat: true, nag: true, tags: true }, state.settings.details || {});
  const subLine = (a, archived) => {
    const d = det(); const parts = [];
    if (d.repeat) parts.push(subOf(a));
    if (!archived && d.nag && a.persistent) parts.push(`nags every ${a.nag}m`);
    return parts.length ? `<div class="sub">${esc(parts.join(' · '))}</div>` : '';
  };
  const tagPills = (a) => (det().tags && a.tags && a.tags.length) ? `<div class="tags">${a.tags.map((t) => `<span style="color:${tagColor(t)}">#${esc(t)}</span>`).join('')}</div>` : '';

  function swipeRow(a, archived) {
    const c = (a.tags && a.tags[0]) ? tagColor(a.tags[0]) : cc(a.color || COLORS[0]);
    const tray = archived
      ? `<button class="tray-b go" data-action="reactivate" data-id="${a.id}">${ICON.restore}<span>Reactivate</span></button>`
      : a.enabled
        ? ''
        : `<button class="tray-b go" data-action="reactivate" data-id="${a.id}">${ICON.restore}<span>Reactivate</span></button>`;
    const body = archived
      ? `<button class="card-main" data-action="edit" data-id="${a.id}">
            ${timeCell(a)}
            <div class="meta"><div class="lbl">${esc(a.label || 'Reminder')}</div>${subLine(a, true)}${tagPills(a)}</div>
          </button>`
      : `<button class="card-main" data-action="edit" data-id="${a.id}">
            ${timeCell(a)}
            <div class="meta"><div class="lbl">${esc(a.label || 'Reminder')}</div>
              ${subLine(a, false)}${tagPills(a)}</div>
          </button>
          <label class="sw" style="--c:${c}"><input type="checkbox" data-action="toggle" data-id="${a.id}" ${a.enabled ? 'checked' : ''} aria-label="Enable"><span></span></label>`;
    return `<div class="swipe" data-swipe="${a.id}">
        <div class="swipe-tray">${tray}<button class="tray-b del" data-action="delAlarm" data-id="${a.id}">${ICON.trash}<span>Delete</span></button>${!archived && a.enabled && !a.loc && C.nextOccurrence(a, new Date()) ? `<button class="tray-b go" data-action="doneNext" data-id="${a.id}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg><span>Done</span></button>` : ''}</div>
        <article class="card swipable ${archived ? 'arch' : a.enabled ? '' : 'off'}" style="--c:${archived ? 'var(--violet)' : c}">${body}</article>
      </div>`;
  }

  function doneNext(id) {
    const a = state.alarms.find((x) => x.id === id); if (!a) return;
    const now = new Date(); const nx = C.nextOccurrence(a, now); if (!nx) return;
    if (!(a.days && a.days.length)) {
      a.archived = true; a.archivedAt = Date.now(); a.enabled = false;
      toast('Done · moved to Archived');
    } else {
      a.skip = (a.skip || []).filter((t) => t > Date.now()); a.skip.push(nx.getTime());
      const n2 = C.nextOccurrence(a, now);
      toast('Done for ' + C.fmtWhen(nx) + (n2 ? ' · next ' + C.fmtWhen(n2) : ''));
    }
    save(); afterChange();
  }
  function archiveAlarm(id) {
    const a = state.alarms.find((x) => x.id === id); if (!a) return;
    a.archived = true; a.archivedAt = Date.now(); a.enabled = false;
    save(); renderMain(); toast('Archived · find it at the bottom');
  }
  function reactivate(id) {
    const a = state.alarms.find((x) => x.id === id); if (!a) return;
    a.archived = false; a.archivedAt = null; a.enabled = true;
    const now = new Date();
    if (!(a.days && a.days.length)) a.date = C.nextOneOffDate(a.time, now);   // one-offs: next time the clock hits it
    state.lastTick = Date.now();
    save(); renderMain();
    const n = C.nextOccurrence(a, now);
    toast(n ? 'Reactivated · next ' + C.fmtWhen(n, now) : 'Reactivated');
  }
  function deleteAlarm(id) {
    if (!confirm('Delete this reminder forever?')) return;
    state.alarms = state.alarms.filter((x) => x.id !== id);
    save(); renderMain();
  }

  /* swipe right on a reminder to reveal Archive / Reactivate and Delete */
  let swipedAt = 0; let openWrap = null;
  function closeOpen() {
    if (!openWrap) return;
    const c = openWrap.querySelector('.swipable'); if (c) { c.style.transition = 'transform .2s ease-out'; c.style.transform = ''; }
    openWrap.classList.remove('open'); openWrap = null;
  }
  (function swipe() {
    let cur = null;
    document.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const card = ev.target.closest('.swipable');
      if (!card) { if (!ev.target.closest('.swipe-tray')) closeOpen(); return; }
      if (ev.target.closest('.sw')) return;
      const wrap = card.parentElement;
      if (openWrap && openWrap !== wrap) closeOpen();
      const trayW = wrap.querySelector('.swipe-tray').offsetWidth;
      cur = { card, wrap, trayW, base: wrap.classList.contains('open') ? trayW : 0, x: ev.clientX, y: ev.clientY, pos: 0, on: false, id: ev.pointerId };
    });
    document.addEventListener('pointermove', (ev) => {
      if (!cur || ev.pointerId !== cur.id) return;
      const dx = ev.clientX - cur.x; const dy = ev.clientY - cur.y;
      if (!cur.on) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { cur = null; return; }
        if (Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) { cur.on = true; cur.card.style.transition = 'none'; try { cur.card.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ } }
        else return;
      }
      cur.pos = Math.min(cur.trayW + 24, Math.max(0, cur.base + dx));
      cur.card.style.transform = `translateX(${cur.pos}px)`;
    });
    const end = (ev) => {
      if (!cur || ev.pointerId !== cur.id) return;
      const { card, wrap, pos, trayW, on } = cur; cur = null;
      if (!on) return;
      swipedAt = Date.now();
      card.style.transition = 'transform .2s ease-out';
      if (ev.type === 'pointerup' && pos > trayW * 0.45) {
        card.style.transform = `translateX(${trayW}px)`; wrap.classList.add('open'); openWrap = wrap;
      } else {
        card.style.transform = ''; wrap.classList.remove('open'); if (openWrap === wrap) openWrap = null;
      }
    };
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
  })();
  // tapping an open card just closes it (no accidental edit); taps right after a swipe are ignored
  document.addEventListener('click', (ev) => {
    if (Date.now() - swipedAt < 350) { ev.stopPropagation(); ev.preventDefault(); return; }
    if (openWrap && ev.target.closest('.swipable') && openWrap.contains(ev.target)) { ev.stopPropagation(); ev.preventDefault(); closeOpen(); }
  }, true);

  function renderNext() {
    return; // "Next" line removed
    // eslint-disable-next-line no-unreachable
    const el = $('#next'); const now = new Date();
    let best = null;
    for (const a of state.alarms) {
      if (!a.enabled) continue;
      const n = C.nextOccurrence(a, now);
      if (n && (!best || n < best.t)) best = { a, t: n };
    }
    const snz = state.pending.filter((p) => p.nextRingAt < NEVER && p.nextRingAt > now.getTime()).sort((x, y) => x.nextRingAt - y.nextRingAt)[0];
    if (snz && (!best || snz.nextRingAt < best.t.getTime())) best = { a: { label: snz.label }, t: new Date(snz.nextRingAt) };
    el.innerHTML = best ? `<div class="next">Next · <b>${esc(best.a.label || 'Reminder')}</b> in <em>${C.fmtDelta(best.t - now)}</em></div>` : '';
  }


  /* ================= Lists tab ================= */
  let tab = 'rem'; let listFilter = null; let doneOpen = false;
  const itemById = (id) => (state.items || []).find((x) => x.id === id);
  const itemAlarm = (it) => it && it.rid ? state.alarms.find((x) => x.id === it.rid) : null;
  function itemWhen(it) {
    const a = itemAlarm(it); if (!a) return '';
    if (a.loc) return `${ICON.pin}<span>${esc(a.loc.name || 'a place')}</span>`;
    const n = C.nextOccurrence(a, new Date());
    return n ? `${ICON.clock}<span>${esc(C.fmtWhen(n, new Date()))}</span>` : '';
  }
  function setTab(t) {
    tab = t;
    $('#tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    const L = t === 'lists';
    ['#needs', '#next', '#list'].forEach((q) => { const e = $(q); if (e) e.hidden = L; });
    $('#lists').hidden = !L;
    $('#fab').hidden = L;
    $('#fab').setAttribute('aria-label', L ? 'Add list item' : 'Add reminder');
    renderLists();
  }
  // every tag keeps its own colour (assigned in order, remembered)
  const TAGHUES = ['#00f0ff', '#ff9f1a', '#a66bff', '#b6ff00', '#ff2bd6', '#ffe600', '#e5484d', '#3b82c4', '#8b5e3c', '#7a8794'];
  const hueCss = (h) => (KEYS[h] ? cc(h) : (isDark() ? lighten(h, 0.22) : h));
  function tagColor(t) {
    const m = state.settings.tagColors || (state.settings.tagColors = {});
    if (m[t] === undefined) { m[t] = Object.keys(m).length % TAGHUES.length; save(); }
    return hueCss(TAGHUES[m[t] % TAGHUES.length]);
  }
  let tagPick = null;
  function setTagHue(t, i) { tagColor(t); state.settings.tagColors[t] = i; save(); }
  function addSettingTag(raw) {
    const t = cleanTag(raw); if (!t) return false;
    state.settings.tagList = state.settings.tagList || [];
    if (!allTags().includes(t)) state.settings.tagList.push(t);
    tagColor(t); save(); return true;
  }
  function deleteTag(t) {
    state.settings.tagList = (state.settings.tagList || []).filter((x) => x !== t);
    state.items.forEach((x) => { x.tags = (x.tags || []).filter((g) => g !== t); });
    state.alarms.forEach((x) => { x.tags = (x.tags || []).filter((g) => g !== t); });
    save(); renderMain();
  }
  const tagCount = (t) => state.items.filter((x) => (x.tags || []).includes(t)).length + state.alarms.filter((x) => (x.tags || []).includes(t)).length;
  const fillVal = () => (state.settings.tagFill === undefined ? 14 : state.settings.tagFill);
  const tagSettingsHtml = () => {
    const tags = allTags();
    const demo = (tags.length ? tags : ['shopping', 'school', 'home']).slice(0, 3);
    return `<div class="set-h" data-hint="${tags.length} tag${tags.length === 1 ? '' : 's'}">Tags &amp; list colour</div>
      ${tags.length ? `<div class="tchips">${tags.map((t) => `<span class="tchip"><button class="tdot sm" data-action="tagHue" data-tag="${esc(t)}" style="background:${tagColor(t)}" aria-label="Change colour of ${esc(t)}"></button><b title="${tagCount(t)} in use">#${esc(t)}</b><button class="x" data-action="tagDel" data-tag="${esc(t)}" aria-label="Delete tag ${esc(t)}">&times;</button></span>`).join('')}</div>` : '<p class="muted" style="font-weight:600;font-size:14px;margin:0 0 8px">No tags yet. Add one below.</p>'}
      ${tagPick && tags.includes(tagPick) ? `<div class="hues">${TAGHUES.map((h, i) => `<button class="sw-c ${(state.settings.tagColors[tagPick] % TAGHUES.length) === i ? 'on' : ''}" style="--sc:${hueCss(h)}" data-action="tagSet" data-tag="${esc(tagPick)}" data-i="${i}" aria-label="Colour ${i + 1}"></button>`).join('')}</div><p class="muted" style="font-weight:600;font-size:12px;margin:-6px 0 8px">Colour for #${esc(tagPick)}</p>` : ''}
      <div class="inline" style="margin:8px 0 14px"><input id="s-tagin" type="text" maxlength="20" placeholder="New tag, e.g. shopping" enterkeyhint="done"><button class="btn small" id="s-tagadd" type="button">Add</button></div>
      <div class="fld"><span class="cap">List item fill <b id="s-fillv" style="color:var(--ink)">${fillVal()}%</b></span>
        <input id="s-fill" type="range" min="0" max="50" step="1" value="${fillVal()}" class="range">
        <div id="s-fillprev" style="margin-top:10px">${demo.map((t) => `<div class="li-wrap" style="margin-bottom:6px"><article class="li" style="--c:${tagColor(t)}"><span class="tick" style="pointer-events:none"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div class="li-main"><div class="lbl">Sample item</div><div class="tags"><span style="color:${tagColor(t)}">#${esc(t)}</span></div></div></article></div>`).join('')}</div>
      </div>`;
  };
  let listSel = [];
  function itemRow(it) {
    const w = itemWhen(it);
    const first = (it.tags || [])[0];
    const col = it.done ? 'var(--faint)' : (first ? tagColor(first) : 'var(--line2)');
    const tg = det().tags && it.tags && it.tags.length > 1 ? `<div class="tags">${it.tags.map((t) => `<span style="color:${tagColor(t)}">#${esc(t)}</span>`).join('')}</div>` : '';
    return `<div class="li-wrap" data-li="${it.id}"><div class="li-del">${ICON.trash}</div>
    <article class="li ${it.done ? 'done' : ''}" style="--c:${col}">
      <button class="tick" data-action="tickItem" data-id="${it.id}" aria-label="${it.done ? 'Untick' : 'Tick off'}" aria-pressed="${!!it.done}"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>
      <button class="li-main" data-action="editItem" data-id="${it.id}">
        <div class="lbl">${esc(it.text)}</div>
        ${w ? `<div class="sub when">${w}</div>` : ''}${tg}
      </button></article></div>`;
  }
  function renderLists() {
    const el = $('#lists'); if (!el) return;
    const items = state.items || [];
    const pool = allTags(); listSel = listSel.filter((t) => pool.includes(t));
    const open = items.filter((x) => !x.done).sort((a, b) => (a.created || 0) - (b.created || 0));
    const dn = items.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    let html = `<form id="liForm" class="quick" autocomplete="off"><input id="liIn" type="text" enterkeyhint="send" placeholder='Add to list, e.g. "milk"' aria-label="Add a list item"><button type="submit" class="icon-btn go" aria-label="Add">${ICON.send}</button></form>`;
    if (pool.length) html += `<div class="tagbar" id="liTags">${pool.map((t) => `<button type="button" class="chip tg ${listSel.includes(t) ? 'on' : ''}" style="--tc:${tagColor(t)}" data-action="selTag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}</div>`;
    if (!open.length) html += `<div class="empty"><b>${items.length ? 'All done' : 'Your list is empty'}</b>Type above. Pick tags to file it, or tap an item for a reminder.</div>`;
    else {
      const groups = new Map();
      open.forEach((x) => { const k = (x.tags && x.tags[0]) || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); });
      const keys = [...groups.keys()].filter(Boolean).sort(); if (groups.has('')) keys.push('');
      keys.forEach((k) => {
        const g = groups.get(k);
        html += `<h3 class="sec-h tagsec" style="--tc:${k ? tagColor(k) : 'var(--muted)'}">${k ? '#' + esc(k) : 'No tag'} <span class="hint">${g.length}</span></h3>` + g.map(itemRow).join('');
      });
    }
    if (dn.length) {
      html += `<button class="arch-h" data-action="toggleDone" aria-expanded="${doneOpen}"><span>Done <b>${dn.length}</b></span><i class="${doneOpen ? 'open' : ''}">${ICON.down}</i></button>`;
      if (doneOpen) html += `<div class="arch-list">${dn.map(itemRow).join('')}<button class="btn ghost small" data-action="clearDone" style="margin-top:4px">Clear ticked items</button></div>`;
    }
    const keep = document.activeElement && document.activeElement.id === 'liIn' && $('#liIn') ? $('#liIn').value : '';
    el.innerHTML = html;
    if (keep) { const i = $('#liIn'); i.value = keep; i.focus(); }
  }
  function parseItemText(raw) {
    const tags = []; const text = String(raw).replace(/(^|\s)#([A-Za-z0-9_-]+)/g, (m, sp, t) => { const c = cleanTag(t); if (c && !tags.includes(c)) tags.push(c); return sp; }).replace(/\s+/g, ' ').trim();
    return { text, tags };
  }
  function addItem(raw) {
    const parsed = parseItemText(raw); const text = parsed.text; if (!text) return false;
    const tags = [...new Set([...listSel, ...parsed.tags])];
    state.items.push({ id: uid(), text: text.slice(0, 120), done: false, tags, rid: null, created: Date.now() });
    save(); renderLists(); return true;
  }
  function tickItem(id) {
    const it = itemById(id); if (!it) return;
    it.done = !it.done; it.doneAt = it.done ? Date.now() : null;
    const a = itemAlarm(it);
    if (a) {
      if (it.done) { a.enabled = false; state.pending = state.pending.filter((p) => p.alarmId !== a.id); }
      else { state.lastTick = Date.now(); a.enabled = !!(a.loc || C.nextOccurrence(a, new Date())); }
    }
    save(); renderMain(); syncRing();
  }
  function removeItem(id) {
    const it = itemById(id); if (!it) return;
    if (it.rid) { state.alarms = state.alarms.filter((x) => x.id !== it.rid); state.pending = state.pending.filter((p) => p.alarmId !== it.rid); }
    state.items = state.items.filter((x) => x.id !== id);
    save(); renderMain(); syncRing();
  }
  function itemSheet(id) {
    const draft = id ? null : { id: uid(), text: '', done: false, tags: [], rid: null, created: Date.now(), _new: true };
    pushSheet((el) => renderItem(el, id || draft.id, draft));
  }
  function renderItem(el, id, draft) {
    let it = itemById(id) || draft; const isNew = !itemById(id);
    const $i = (q) => el.querySelector(q);
    const a = itemAlarm(it);
    const when = itemWhen(it);
    const draw = () => {
      $i('#i-tags').innerHTML = allTags().concat(it.tags.filter((t) => !allTags().includes(t))).map((t) => `<button class="chip ${it.tags.includes(t) ? 'on' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`).join('') || '<span class="muted" style="font-size:13px">No tags yet</span>';
    };
    el.innerHTML = `
      <div class="sheet-h"><h2>${isNew ? 'New item' : 'Edit item'}</h2><button class="icon-btn" data-action="closeSheet" aria-label="Close">${ICON.close}</button></div>
      <div class="sheet-b">
        <label class="fld"><span>What</span><input id="i-text" type="text" maxlength="120" placeholder="e.g. Buy milk" value="${esc(it.text)}"></label>
        <div class="fld"><span class="cap">Tags</span>
          <div class="chips small" id="i-tags"></div>
          <div class="inline" style="margin-top:10px"><input id="i-tagin" type="text" maxlength="20" placeholder="Add a tag, e.g. shopping" enterkeyhint="done"><button class="btn small" id="i-tagadd" type="button">Add</button></div>
        </div>
        <div class="fld"><span class="cap">Reminder</span>
          ${a && when ? `<div class="placebox"><div class="pc"><b class="when">${when}</b></div></div>` : '<div class="muted" style="font-size:14px;margin-bottom:8px">No reminder set</div>'}
          <div class="chips small">
            <button class="chip" id="i-rtime" type="button">${a && !a.loc ? 'Change time' : '+ At a time'}</button>
            <button class="chip" id="i-rplace" type="button">${a && a.loc ? 'Change place' : '+ At a place'}</button>
            ${a ? '<button class="chip" id="i-rnone" type="button">Remove reminder</button>' : ''}
          </div>
        </div>
      </div>
      <div class="sheet-f">${isNew ? '' : '<button class="btn ghost danger" id="i-del">Delete</button>'}<button class="btn" id="i-save">Save</button></div>`;
    draw();
    const commit = () => {
      const text = $i('#i-text').value.trim();
      if (!text) { toast('Give it a name first'); return false; }
      it.text = text;
      if (!itemById(it.id)) { delete it._new; state.items.push(it); }
      const al = itemAlarm(it); if (al) { al.label = text; al.tags = [...it.tags]; }
      save(); renderMain(); return true;
    };
    $i('#i-tags').addEventListener('click', (ev) => { const b = ev.target.closest('[data-t]'); if (!b) return; const t = b.dataset.t; it.tags = it.tags.includes(t) ? it.tags.filter((x) => x !== t) : [...it.tags, t]; draw(); });
    const addTag = () => { const t = cleanTag($i('#i-tagin').value); if (!t) return; if (!it.tags.includes(t)) it.tags.push(t); $i('#i-tagin').value = ''; draw(); };
    $i('#i-tagadd').addEventListener('click', addTag);
    $i('#i-tagin').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addTag(); } });
    const remind = (place) => {
      if (!commit()) return;
      const cur = itemById(it.id);
      if (itemAlarm(cur)) { const al = itemAlarm(cur); editSheet(al.id, null, { mode: place ? 'place' : 'time' }); return; }
      const p = newAlarm(); p.label = cur.text; p.tags = [...cur.tags]; p.listId = cur.id; p.persistent = true;
      editSheet(null, p, { mode: place ? 'place' : 'time' });
    };
    $i('#i-rtime').addEventListener('click', () => remind(false));
    $i('#i-rplace').addEventListener('click', () => remind(true));
    const rn = $i('#i-rnone'); if (rn) rn.addEventListener('click', () => { const cur = itemById(it.id) || it; const al = itemAlarm(cur); if (al) { state.alarms = state.alarms.filter((x) => x.id !== al.id); state.pending = state.pending.filter((p) => p.alarmId !== al.id); } cur.rid = null; save(); renderMain(); syncRing(); renderItem(el, it.id, it); });
    const dl = $i('#i-del'); if (dl) dl.addEventListener('click', () => { if (!confirm('Delete this item?')) return; removeItem(it.id); closeSheet(); });
    $i('#i-save').addEventListener('click', () => { if (!commit()) return; closeSheet(); });
  }
  (function liSwipe() {
    let cur = null;
    document.addEventListener('pointerdown', (ev) => {
      const li = ev.target.closest && ev.target.closest('.li'); if (!li || ev.target.closest('.tick')) return;
      cur = { li, wrap: li.parentElement, x: ev.clientX, y: ev.clientY, dx: 0, on: false, id: ev.pointerId };
    });
    document.addEventListener('pointermove', (ev) => {
      if (!cur || ev.pointerId !== cur.id) return;
      const dx = ev.clientX - cur.x; const dy = ev.clientY - cur.y;
      if (!cur.on) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { cur = null; return; }
        if (dx > 12 && dx > Math.abs(dy)) { cur.on = true; cur.li.style.transition = 'none'; try { cur.li.setPointerCapture(ev.pointerId); } catch (e) { /* */ } } else return;
      }
      cur.dx = Math.max(0, dx); cur.li.style.transform = `translateX(${cur.dx}px)`; cur.wrap.style.setProperty('--sw', Math.min(1, cur.dx / 110));
    });
    const end = () => {
      if (!cur) return; const c = cur; cur = null; if (!c.on) return;
      swipedAt = Date.now();
      const w = c.li.offsetWidth;
      c.li.style.transition = 'transform .18s ease-out';
      if (c.dx > Math.min(120, w * 0.4)) {
        c.li.style.transform = `translateX(${w}px)`;
        setTimeout(() => removeItem(c.wrap.dataset.li), 170);
      } else { c.li.style.transform = ''; c.wrap.style.setProperty('--sw', 0); }
    };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  })();
  (function listWiring() {
    document.addEventListener('submit', (ev) => {
      if (ev.target.id !== 'liForm') return; ev.preventDefault();
      const i = $('#liIn'); const v = i.value; i.blur(); if (addItem(v)) { const n = $('#liIn'); if (n) { n.value = ''; n.blur(); } }
    });
    $('#tabs').addEventListener('click', (ev) => { const b = ev.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
  })();

  function renderMain() { renderToday(); renderNeeds(); renderNext(); renderList(); renderLists(); updateBadge(); }
  function afterChange() { renderMain(); syncRing(); }

  /* ================= sheets ================= */

  const sheetWrap = $('#sheetWrap'); const sheetEl = $('#sheet');
  const sheets = [];
  function pushSheet(render) { sheets.push(render); history.pushState({ s: sheets.length }, ''); showTop(); }
  function closeSheet() { if (sheets.length) history.back(); }
  function showTop() {
    if (!sheets.length) { sheetWrap.hidden = true; sheetEl.innerHTML = ''; return; }
    sheetWrap.hidden = false; sheetEl.innerHTML = '';
    sheets[sheets.length - 1](sheetEl);
  }
  window.addEventListener('popstate', () => { if (sheets.length) { sheets.pop(); showTop(); } });

  let toastT = null;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }

  /* ---------- add / edit reminder ---------- */

  function newAlarm() {
    const now = new Date();
    const time = C.hhmm(now);                       // the picker starts at the current time
    return {
      id: uid(), label: '', time, days: [], every: 1, start: null, date: C.ymd(now), tags: [], loc: null, locRepeat: false, enabled: true,
      sound: state.settings.defaultSound || 'pulse', color: COLORS[state.alarms.length % COLORS.length],
      persistent: true, nag: state.settings.defaultNag || 10,   // nagging is on by default
    };
  }

  function editSheet(id, preset, opts) {
    const existing = id ? state.alarms.find((x) => x.id === id) : null;
    const a = existing ? clone(existing) : (preset || newAlarm());
    if (!a.tags) a.tags = [];
    if (opts && (opts.place || opts.mode === 'place') && !a.loc) a._mode = 'place';
    if (opts && opts.mode === 'time' && a.loc) a._mode = 'time';
    pushSheet((el) => renderEdit(el, a, !existing, opts || {}));
  }

  async function searchPlaces(q) {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=en&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('search failed');
    const j = await r.json();
    return j.map((x) => ({ name: String(x.name || (x.display_name || '').split(',')[0]).trim() || q, full: x.display_name || '', lat: Number(x.lat), lon: Number(x.lon) }));
  }

  function renderEdit(el, a, isNew, opts) {
    const mode = a._mode || (a.loc ? 'place' : 'time');
    const radius = (a.loc && a.loc.radius) || 200;
    el.innerHTML = `
      <div class="sheet-h"><h2>${isNew ? 'New reminder' : 'Edit reminder'}</h2><button class="icon-btn" data-action="closeSheet" aria-label="Close">${ICON.close}</button></div>
      <div class="sheet-b">
        <div class="fld"><span>What</span>
          <div class="quick" style="margin:0"><input id="e-label" type="text" maxlength="160" enterkeyhint="go" placeholder='e.g. "Call the doctor next Tuesday 3pm"' value="${esc(a.label)}"><button type="button" id="e-mic" class="icon-btn" aria-label="Speak it">${ICON.mic}</button></div>
          <div id="e-qprev"></div>
          ${isNew ? '<small>Add the time in words, then press Enter and I\'ll fill it in.</small>' : ''}
        </div>
        <div class="fld"><span class="cap">When</span>
          <div class="seg" id="e-mode"><button data-m="time">At a time</button><button data-m="place">At a place</button></div>
        </div>

        <div id="e-timeblock">
          <div class="row2">
            <label class="fld"><span>Time</span>${timeField('e-time', a.time || C.hhmm(new Date()))}</label>
            <label class="fld" id="e-datewrap"><span id="e-datelbl">Date</span><input id="e-date" type="date" value="${esc(a.date || a.start || C.ymd(new Date()))}"></label>
          </div>
          <div class="fld"><span class="cap">Repeat</span>
            <div class="chips" id="e-days">${DAY_ORDER.map((d) => `<button class="chip ${a.days.includes(d) ? 'on' : ''}" data-d="${d}" aria-label="${C.DAYS_FULL[d]}" aria-pressed="${a.days.includes(d)}">${DAY_INITIAL[d]}</button>`).join('')}</div>
            <div class="chips small" style="margin-top:8px">
              <button class="chip" data-rp="once">Once</button><button class="chip" data-rp="daily">Every day</button><button class="chip" data-rp="weekdays">Weekdays</button><button class="chip" data-rp="fortnight">Every 2 weeks</button>
            </div>
            <div class="seg" id="e-every" style="margin-top:10px"><button data-e="1">Every week</button><button data-e="2">Every 2 weeks</button></div>
            <small id="e-rhelp"></small>
          </div>
        </div>

        <div id="e-placeblock" hidden>
          ${isNative() ? '' : '<div class="note" style="margin:0 0 12px">Place reminders only ring in the Android app, not in a browser.</div>'}
          <div class="fld"><span class="cap">Where</span>
            <div class="placebox" id="e-placecur"></div>
            <div class="inline" style="margin-top:10px"><input id="e-q" type="text" placeholder="Search a place, e.g. Tesco Naas" enterkeyhint="search" value="${esc(opts.place || '')}"><button class="btn small" id="e-search" type="button">Search</button></div>
            <div class="plist" id="e-results"></div>
            <button class="btn ghost small" id="e-here" type="button" style="margin-top:10px">Use my current location</button>
            <div class="chips small" id="e-recent" style="margin-top:10px"></div>
          </div>
          <div class="fld"><span class="cap">Rings when I'm within</span>
            <div class="chips small" id="e-radius">${[100, 200, 500, 1000].map((r) => `<button class="chip ${radius === r ? 'on' : ''}" data-r="${r}">${r >= 1000 ? '1 km' : r + ' m'}</button>`).join('')}</div>
          </div>
          <div class="toggle-row">
            <div><b>Every time I arrive</b><small>Off = rings once, then switches off</small></div>
            <label class="sw" style="--c:var(--pink)"><input type="checkbox" id="e-locrep" ${a.locRepeat ? 'checked' : ''}><span></span></label>
          </div>
          <div class="note">Needs Location set to “Allow all the time” so it works with the app closed. Arrival alerts can be a minute or two late.</div>
        </div>

        <div class="fld"><span class="cap">Tags</span>
          <div class="chips small" id="e-tags"></div>
          <div class="inline" style="margin-top:10px"><input id="e-tagin" type="text" maxlength="20" placeholder="Add a tag, e.g. school" enterkeyhint="done"><button class="btn small" id="e-tagadd" type="button">Add</button></div>
        </div>
        <div class="fld"><span class="cap">Sound (tap to preview)</span>
          <div class="chips" id="e-sounds">${Object.entries(SOUNDS).map(([k, s]) => `<button class="chip ${a.sound === k ? 'on' : ''}" data-s="${k}">${s.name}</button>`).join('')}</div>
        </div>
        <div class="fld"><span class="cap">Colour</span>
          <div class="swatches" id="e-colors">${COLORS.map((c) => `<button class="sw-c ${a.color === c ? 'on' : ''}" style="--sc:${cc(c)}" data-c="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
        </div>
        <div class="toggle-row">
          <div><b>Keep nagging</b><small>If you dismiss it, it rings again until you tap Done</small></div>
          <label class="sw" style="--c:var(--pink)"><input type="checkbox" id="e-persist" ${a.persistent ? 'checked' : ''}><span></span></label>
        </div>
        <div class="fld" id="e-nagwrap"><span class="cap">Ring again every</span>
          <div class="chips small">${NAGS.map((n) => `<button class="chip" data-n="${n}">${n} min</button>`).join('')}</div>
          <div class="inline" style="margin-top:10px"><input id="e-nag" type="number" min="1" max="720" inputmode="numeric" value="${a.nag}"><span class="muted">minutes</span></div>
        </div>
      </div>
      <div class="sheet-f">${isNew ? '' : '<button class="btn ghost danger" id="e-del">Delete</button>'}<button class="btn" id="e-save">Save</button></div>`;

    const $e = (s) => el.querySelector(s);
    const curMode = () => a._mode || (a.loc ? 'place' : 'time');
    const refresh = () => {
      const m = curMode();
      el.querySelectorAll('#e-mode [data-m]').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
      $e('#e-timeblock').hidden = m !== 'time'; $e('#e-placeblock').hidden = m !== 'place';
      const every = Number(a.every) || 1;
      $e('#e-datewrap').hidden = a.days.length > 0 && every === 1;
      $e('#e-datelbl').textContent = a.days.length ? 'Starting from' : 'Date';
      $e('#e-every').hidden = !a.days.length;
      el.querySelectorAll('#e-every [data-e]').forEach((b) => b.classList.toggle('on', Number(b.dataset.e) === every));
      el.querySelectorAll('#e-days .chip').forEach((b) => { const on = a.days.includes(Number(b.dataset.d)); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      el.querySelectorAll('[data-rp]').forEach((b) => {
        const k = b.dataset.rp; const days = a.days.slice().sort((x, y) => x - y).join();
        b.classList.toggle('on', (k === 'once' && !a.days.length) || (k === 'daily' && a.days.length === 7 && every === 1) || (k === 'weekdays' && days === '1,2,3,4,5' && every === 1) || (k === 'fortnight' && a.days.length > 0 && every === 2));
      });
      $e('#e-rhelp').textContent = a.days.length ? C.repeatLabel(a) + (every > 1 ? ' · counting from the week of the date above' : '') : 'Rings once on the date above';
      $e('#e-nagwrap').hidden = !a.persistent;
      const nag = Number($e('#e-nag').value);
      el.querySelectorAll('[data-n]').forEach((b) => b.classList.toggle('on', Number(b.dataset.n) === nag));
      // place
      const loc = a.loc;
      $e('#e-placecur').innerHTML = loc
        ? `<div class="pc">${ICON.pin}<div><input id="e-pname" type="text" maxlength="40" value="${esc(loc.name)}" aria-label="Place name"><small>${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</small></div></div>`
        : `<div class="pc none">${ICON.pin}<div class="muted">No place chosen yet</div></div>`;
      const pn = $e('#e-pname'); if (pn) pn.addEventListener('input', () => { a.loc.name = pn.value; });
      el.querySelectorAll('#e-radius .chip').forEach((b) => b.classList.toggle('on', Number(b.dataset.r) === ((loc && loc.radius) || a._radius || 200)));
      $e('#e-recent').innerHTML = recentPlaces().map((p, i) => `<button class="chip" data-rec="${i}">${ICON.pin.replace('<svg', '<svg class="mini"')} ${esc(p.name)}</button>`).join('');
      // tags
      const known = [...new Set([...allTags(), ...a.tags])].sort();
      $e('#e-tags').innerHTML = known.length ? known.map((t) => `<button class="chip ${a.tags.includes(t) ? 'on' : ''}" data-t="${esc(t)}">#${esc(t)}</button>`).join('') : '<span class="muted" style="font-weight:600;font-size:13px">No tags yet</span>';
    };
    const setLoc = (p) => { a.loc = { name: p.name, lat: p.lat, lon: p.lon, radius: (a.loc && a.loc.radius) || a._radius || 200 }; refresh(); };

    $e('#e-mode').addEventListener('click', (ev) => { const b = ev.target.closest('[data-m]'); if (!b) return; a._mode = b.dataset.m; refresh(); });
    $e('#e-days').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-d]'); if (!b) return;
      const d = Number(b.dataset.d);
      a.days = a.days.includes(d) ? a.days.filter((x) => x !== d) : [...a.days, d];
      refresh();
    });
    el.querySelectorAll('[data-rp]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.rp;
      if (k === 'fortnight') {
        const base = $e('#e-date').value ? C.parseYmd($e('#e-date').value) : new Date();
        if (!a.days.length) a.days = [base.getDay()];
        a.every = 2;
      } else {
        a.days = { once: [], daily: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5] }[k]; a.every = 1;
      }
      refresh();
    }));
    $e('#e-every').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-e]'); if (!b) return;
      a.every = Number(b.dataset.e); refresh();
    });
    $e('#e-sounds').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-s]'); if (!b) return;
      a.sound = b.dataset.s;
      el.querySelectorAll('#e-sounds .chip').forEach((x) => x.classList.toggle('on', x === b));
      playOnce(a.sound);
    });
    $e('#e-colors').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-c]'); if (!b) return;
      a.color = b.dataset.c;
      el.querySelectorAll('#e-colors .sw-c').forEach((x) => x.classList.toggle('on', x === b));
    });
    $e('#e-persist').addEventListener('change', (ev) => { a.persistent = ev.target.checked; refresh(); });
    el.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { $e('#e-nag').value = b.dataset.n; refresh(); }));
    $e('#e-nag').addEventListener('input', refresh);

    // tags
    const addTag = () => {
      const t = cleanTag($e('#e-tagin').value); if (!t) return;
      if (!a.tags.includes(t)) a.tags.push(t);
      $e('#e-tagin').value = ''; refresh();
    };
    $e('#e-tagadd').addEventListener('click', addTag);
    $e('#e-tagin').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addTag(); } });
    $e('#e-tags').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-t]'); if (!b) return;
      const t = b.dataset.t; a.tags = a.tags.includes(t) ? a.tags.filter((x) => x !== t) : [...a.tags, t]; refresh();
    });

    // place
    $e('#e-radius').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-r]'); if (!b) return;
      a._radius = Number(b.dataset.r); if (a.loc) a.loc.radius = a._radius; refresh();
    });
    $e('#e-recent').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-rec]'); if (!b) return;
      const p = recentPlaces()[Number(b.dataset.rec)]; if (p) setLoc(p);
    });
    const doSearch = async () => {
      const q = $e('#e-q').value.trim(); if (!q) return;
      const box = $e('#e-results'); box.innerHTML = '<div class="muted" style="padding:8px 2px;font-weight:700">Searching…</div>';
      try {
        const res = await searchPlaces(q);
        window.__lastResults = res;
        box.innerHTML = res.length
          ? res.map((r, i) => `<button class="pres" data-i="${i}">${ICON.pin}<span><b>${esc(r.name)}</b><small>${esc(r.full)}</small></span></button>`).join('')
          : '<div class="muted" style="padding:8px 2px;font-weight:700">Nothing found. Try adding the town.</div>';
      } catch (e) { box.innerHTML = '<div class="muted" style="padding:8px 2px;font-weight:700">Couldn’t search. Check your connection.</div>'; }
    };
    $e('#e-search').addEventListener('click', doSearch);
    $e('#e-q').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); doSearch(); } });
    $e('#e-results').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-i]'); if (!b) return;
      const r = (window.__lastResults || [])[Number(b.dataset.i)]; if (!r) return;
      $e('#e-results').innerHTML = ''; setLoc(r);
    });
    $e('#e-here').addEventListener('click', () => {
      if (!navigator.geolocation) { toast('Location isn’t available here'); return; }
      toast('Finding you…');
      navigator.geolocation.getCurrentPosition(
        (pos) => setLoc({ name: 'My location', lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => toast('Couldn’t get your location. Check Location is on and allowed for Nudge.'),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    });

    $e('#e-save').addEventListener('click', async () => {
      if (isNew && !a._applied && apply()) { setTimeout(() => { const sv = el.querySelector('#e-save'); if (sv) sv.click(); }, 0); return; }
      a.label = $e('#e-label').value.trim();
      a.nag = Math.min(720, Math.max(1, Number($e('#e-nag').value) || 10));
      a.enabled = true;
      const now = new Date();
      const m = curMode();
      if (m === 'place') {
        if (!a.loc) { toast('Choose a place first'); return; }
        const pn2 = $e('#e-pname'); if (pn2 && pn2.value.trim()) a.loc.name = pn2.value.trim();
        a.loc.radius = a._radius || a.loc.radius || 200;
        a.locRepeat = $e('#e-locrep').checked;
        a.time = null; a.days = []; a.date = null; a.every = 1; a.start = null;
      } else {
        a.loc = null; a.locRepeat = false;
        a.time = $e('#e-time').value || a.time || C.hhmm(now);
        if (!a.days.length) {
          a.every = 1; a.start = null;
          const chosen = $e('#e-date').value;
          a.date = chosen || C.nextOneOffDate(a.time, now);
          if (C.atTime(C.parseYmd(a.date), a.time) <= now) { a.date = C.nextOneOffDate(a.time, now); toast('That time has passed, set for ' + C.fmtWhen(C.atTime(C.parseYmd(a.date), a.time), now)); }
        } else {
          a.date = null;
          a.every = Number(a.every) === 2 ? 2 : 1;
          a.start = a.every > 1 ? ($e('#e-date').value || C.ymd(now)) : null;
        }
      }
      delete a._mode; delete a._radius; delete a._applied;
      a.archived = false; a.archivedAt = null;
      const i = state.alarms.findIndex((x) => x.id === a.id);
      if (i >= 0) state.alarms[i] = a; else state.alarms.push(a);
      if (a.listId) { const it = (state.items || []).find((x) => x.id === a.listId); if (it) it.rid = a.id; }
      state.lastTick = Date.now(); // don't fire anything for the past
      save(); closeSheet(); renderMain();
      if (a.loc) askLocation();
      if (isNew) askNotify();
    });
    const del = $e('#e-del');
    if (del) del.addEventListener('click', () => {
      if (!confirm('Delete this reminder?')) return;
      state.alarms = state.alarms.filter((x) => x.id !== a.id);
      save(); closeSheet(); renderMain();
    });
    const qin = $e('#e-label'); const prev = $e('#e-qprev');
    const parsed = () => { const v = qin.value.trim(); if (!v) return null; const r = C.parseQuick(v, new Date()); return (r.when || r.place || r.tags.length) ? r : null; };
    const showPrev = () => { const r = isNew ? parsed() : null; prev.innerHTML = r ? `<div class="qa-card">${describeQuick(r)}</div>` : ''; };
    const apply = () => {
      const r = parsed(); if (!r) return false;
      a.time = $e('#e-time').value || a.time; a.nag = Math.min(720, Math.max(1, Number($e('#e-nag').value) || 10));
      const dv = $e('#e-date').value; if (dv) { if (!a.days.length) a.date = dv; else if (Number(a.every) > 1) a.start = dv; }
      a.label = r.title; a.tags = [...new Set([...(a.tags || []), ...r.tags])];
      if (r.when) { a.time = r.time; if (r.days.length) { a.days = r.days; a.every = r.every; a.start = r.start; a.date = null; } else { a.days = []; a.every = 1; a.start = null; a.date = r.date; } }
      let o = opts;
      if (r.place) { a._mode = 'place'; a.loc = null; o = { ...opts, place: r.place }; } else if (r.when) a._mode = 'time';
      a._applied = true;
      renderEdit(el, a, isNew, o);
      return true;
    };
    if (isNew) {
      qin.addEventListener('input', showPrev);
      qin.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); if (!apply()) qin.blur(); } });
    }
    $e('#e-mic').addEventListener('click', () => voiceInput(qin, $e('#e-mic'), () => { if (isNew) { if (!apply()) showPrev(); } }));
    refresh();
    if (opts.place && !a.loc) doSearch();
  }

  /* ---------- places: permission + arrival handling ---------- */

  async function askLocation() {
    const NB = window.NativeBridge;
    if (!isNative() || !NB.ensureLocation) return;
    const g = await NB.ensureLocation();
    if (!g.fg) toast('Allow Location for Nudge to use place reminders');
    else if (!g.bg) toast('Set Location to “Allow all the time” so place reminders work with the app closed');
  }

  function fireLocation(a, at) {
    state.pending = state.pending.filter((p) => p.alarmId !== a.id);
    state.pending.push({
      id: uid(), alarmId: a.id, label: a.label, color: a.color, sound: a.sound, persistent: !!a.persistent, nag: a.nag || 10,
      place: a.loc ? a.loc.name : '', firedAt: at, nextRingAt: Date.now(), mode: 'ring',
    });
  }
  async function pollGeo() {
    const NB = window.NativeBridge;
    if (!isNative() || !NB.consumeFired) return;
    if (NB.takeActions) { const acts = await NB.takeActions(); acts.forEach((a) => fromNotification(a.action, a.extra)); }
    const list = await NB.consumeFired();
    if (!list.length) return;
    let changed = false;
    for (const f of list) {
      const a = state.alarms.find((x) => x.id === f.id);
      if (!a || !a.enabled || !a.loc) continue;
      fireLocation(a, f.at || Date.now());
      if (!a.locRepeat) a.enabled = false;
      changed = true;
    }
    if (changed) { save(); afterChange(); }
  }

  /* ---------- quick add ("call the doctor next tuesday at 3pm") ---------- */

  function describeQuick(r) {
    const now = new Date();
    const bits = [];
    bits.push(`<b>${esc(r.title || 'Reminder')}</b>`);
    if (r.when) {
      if (r.days.length) bits.push(`<span class="pv">${esc(C.repeatLabel({ days: r.days, every: r.every }))} · ${esc(r.time)}</span>`);
      else bits.push(`<span class="pv">${esc(C.fmtWhen(C.atTime(C.parseYmd(r.date), r.time), now))}</span>`);
    }
    if (r.place) bits.push(`<span class="pv">${ICON.pin.replace('<svg', '<svg class="mini"')} ${esc(r.place)}</span>`);
    r.tags.forEach((t) => bits.push(`<span class="pv tag2">#${esc(t)}</span>`));
    if (!r.when && !r.place) bits.push('<span class="pv dim">No time found</span>');
    return bits.join('');
  }
  async function voiceInput(input, mic, onText) {
    const NB = window.NativeBridge;
    if (isNative() && NB.speak) {
      try { const t = await NB.speak(); if (t) { input.value = t; onText(); } } catch (e) { toast('Voice input isn’t available. Try the mic on your keyboard.'); }
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Voice isn’t available here. Try the mic on your keyboard.'); return; }
    const r = new SR(); r.lang = navigator.language || 'en-IE'; r.interimResults = true;
    r.onresult = (e) => { input.value = [...e.results].map((x) => x[0].transcript).join(' '); onText(); };
    r.onend = () => mic.classList.remove('on'); r.onerror = () => mic.classList.remove('on');
    mic.classList.add('on'); try { r.start(); } catch (e) { mic.classList.remove('on'); }
  }

  /* ---------- snooze sheet (for items in "Needs you") ---------- */

  function snoozeSheet(pid) {
    pushSheet((el) => {
      const p = pendingById(pid);
      if (!p) { el.innerHTML = ''; return; }
      el.innerHTML = `<div class="sheet-h"><h2>Snooze</h2><button class="icon-btn" data-action="closeSheet" aria-label="Close">${ICON.close}</button></div>
        <div class="sheet-b"><p class="muted" style="font-weight:700;margin-bottom:14px">${esc(p.label || 'Reminder')}</p>${snoozeGrid(pid)}</div>`;
    });
  }

  /* ---------- settings ---------- */

  const openSecs = new Set();
  function accordion(html) {
    const end = html.lastIndexOf('</div>'); const tail = html.slice(end); let body = html.slice(0, end);
    const parts = body.split('<div class="set-h"');
    let out = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const m = parts[i].match(/^([^>]*)>([\s\S]*?)<\/div>([\s\S]*)$/);
      if (!m) { out += '<div class="set-h"' + parts[i]; continue; }
      const hint = (m[1].match(/data-hint="([^"]*)"/) || [])[1]; const force = /data-open="1"/.test(m[1]); const title = m[2];
      const k = title.replace(/&amp;/g, '&');
      out += `<details class="acc" data-k="${k}" ${openSecs.has(k) || force ? 'open' : ''}><summary><span>${title}</span>${hint ? `<em>${hint}</em>` : ''}<i class="chev"></i></summary><div class="acc-b">${m[3]}</div></details>`;
    }
    return out + tail;
  }
  let settingsRef = null;
  function settingsSheet() {
    const render = (el) => {
      const now = new Date();
      const NB = window.NativeBridge; const native = isNative();
      const perm = native
        ? ({ granted: 'Allowed', denied: 'Blocked', unknown: 'Checking…' }[NB.perm.notif] || 'Not enabled')
        : (!('Notification' in window) ? 'Not supported' : { granted: 'Allowed', denied: 'Blocked', default: 'Not enabled' }[Notification.permission]);
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      if (native) {
        const before = JSON.stringify(NB.perm) + JSON.stringify(NB.geo);
        Promise.all([NB.refreshPerm(), NB.geoStatus ? NB.geoStatus() : null]).then(() => { if (JSON.stringify(NB.perm) + JSON.stringify(NB.geo) !== before && sheets[sheets.length - 1] === render) showTop(); });
      }
      const geoTxt = native && NB.geo ? (NB.geo.bg ? 'Allowed all the time' : NB.geo.fg ? 'Only while the app is open · set to “Allow all the time”' : 'Not allowed') : '';
      el.innerHTML = accordion(`
        <div class="sheet-h"><h2>Settings</h2><button class="icon-btn" data-action="closeSheet" aria-label="Close">${ICON.close}</button></div>
        <div class="sheet-b">
          <div class="srow"><div><b>Iarla's a Sack</b><small>Dark mode</small></div><label class="sw"><input type="checkbox" id="s-dark" ${state.settings.dark ? 'checked' : ''}><span></span></label></div>
          <div class="set-h" data-hint="${PALETTES[palKey()].name}">Look</div>
          <div class="fld" style="margin:4px 0 12px"><span class="cap">Colours</span>
            <div class="pals">${Object.entries(PALETTES).map(([k, p]) => `<button class="pal ${palKey() === k ? 'on' : ''}" data-action="palette" data-pal="${k}"><i>${['cyan', 'pink', 'lime', 'orange', 'violet', 'yellow'].map((n) => `<u style="background:${p.light ? (isDark() ? lighten(p.light[n], 0.22) : p.light[n]) : (isDark() ? Object.keys(KEYS).find((h) => KEYS[h] === n) : SHADE[Object.keys(KEYS).find((h) => KEYS[h] === n)])}"></u>`).join('')}</i><b>${p.name}</b></button>`).join('')}</div>
          </div>

          ${tagSettingsHtml()}

          <div class="set-h">Reminder list</div>
          <p class="muted" style="font-weight:600;font-size:14px;margin-bottom:8px">Choose which details show under each reminder. Fewer details means shorter rows, so more fit on screen.</p>
          <div class="srow"><div><b>Repeat / place</b><small>e.g. Every 2 weeks · Wed</small></div><label class="sw"><input type="checkbox" data-det="repeat" ${det().repeat ? 'checked' : ''}><span></span></label></div>
          <div class="srow"><div><b>Nagging</b><small>e.g. nags every 10m</small></div><label class="sw"><input type="checkbox" data-det="nag" ${det().nag ? 'checked' : ''}><span></span></label></div>
          <div class="srow"><div><b>Tags</b><small>e.g. #school</small></div><label class="sw"><input type="checkbox" data-det="tags" ${det().tags ? 'checked' : ''}><span></span></label></div>


          <div class="set-h">Snooze menu</div>
          <p class="muted" style="font-weight:600;font-size:14px;margin-bottom:12px">These appear when a reminder rings. The first one is also the quick-snooze button on the notification.</p>
          ${state.presets.map((pr, i) => {
            const when = C.resolveSnooze(pr, now);
            return `<div class="prow"><button class="pm" data-action="editPreset" data-id="${pr.id}"><b>${esc(C.presetLabel(pr))}</b><small>${when ? '→ ' + esc(C.fmtWhen(when, now)) : 'date has passed'}</small></button>
              <button class="icon-btn" data-action="presetUp" data-id="${pr.id}" aria-label="Move up" ${i === 0 ? 'disabled style="opacity:.3"' : ''}>${ICON.up}</button>
              <button class="icon-btn" data-action="presetDown" data-id="${pr.id}" aria-label="Move down" ${i === state.presets.length - 1 ? 'disabled style="opacity:.3"' : ''}>${ICON.down}</button>
              <button class="icon-btn" data-action="presetDel" data-id="${pr.id}" aria-label="Delete">${ICON.trash}</button></div>`;
          }).join('')}
          <div style="display:flex;gap:8px;margin-top:6px"><button class="btn small" data-action="editPreset" data-id="">+ Add snooze</button><button class="btn small ghost" data-action="presetReset">Reset to defaults</button></div>

          <div class="set-h">Defaults for new reminders</div>
          <div class="srow"><div><b>Nag interval</b><small>When “Keep nagging” is on</small></div><div class="inline"><input id="s-nag" type="number" min="1" max="720" inputmode="numeric" value="${state.settings.defaultNag}" style="width:84px"><span class="muted">min</span></div></div>
          <div class="srow"><div><b>Sound</b></div><select id="s-sound" style="width:auto;min-width:140px">${Object.entries(SOUNDS).map(([k, s]) => `<option value="${k}" ${state.settings.defaultSound === k ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>

          ${(() => {
            const sy = window.NudgeSync; if (!sy) return '';
            const u = sy.ui; const ago = sy.last ? new Date(sy.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            if (u.state === 'pair' && u.pair) return `<div class="set-h" data-hint="${esc(window.NudgeSync.ui.state === 'busy' ? 'Syncing' : window.NudgeSync.connected ? 'On' : 'Off')}" data-open="${window.NudgeSync.ui.state === 'pair' || window.NudgeSync.ui.state === 'err' ? 1 : 0}">Sync</div><div class="srow"><div><b>Enter this code</b><small>On any device open <a href="${u.pair.url}" target="_blank" rel="noopener">${u.pair.url}</a>, sign in and type the code</small></div></div><div style="font:800 30px/1 ui-monospace,monospace;letter-spacing:.14em;text-align:center;padding:12px 0">${esc(u.pair.code)}</div><button class="btn ghost" style="width:100%" data-action="syncCancel">Cancel</button>`;
            if (sy.connected) return `<div class="set-h" data-hint="${esc(window.NudgeSync.ui.state === 'busy' ? 'Syncing' : window.NudgeSync.connected ? 'On' : 'Off')}" data-open="${window.NudgeSync.ui.state === 'pair' || window.NudgeSync.ui.state === 'err' ? 1 : 0}">Sync</div><div class="srow"><div><b>Google Drive</b><small>${u.state === 'busy' ? 'Syncing…' : u.state === 'err' ? esc(u.msg) : 'In step' + (ago ? ' · ' + ago : '')}</small></div>${/Reconnect/.test(u.msg || '') ? '<button class="btn small" data-action="syncOn">Reconnect</button>' : '<button class="btn small" data-action="syncNow">Sync now</button>'}</div><button class="btn ghost" style="width:100%" data-action="syncOff">Disconnect</button>`;
            return `<div class="set-h" data-hint="${esc(window.NudgeSync.ui.state === 'busy' ? 'Syncing' : window.NudgeSync.connected ? 'On' : 'Off')}" data-open="${window.NudgeSync.ui.state === 'pair' || window.NudgeSync.ui.state === 'err' ? 1 : 0}">Sync</div><div class="srow"><div><b>Google Drive</b><small>${esc(u.msg) || 'Keep this and your other devices in step'}</small></div><button class="btn small" data-action="syncOn">Connect</button></div>`;
          })()}

          <div class="set-h">Alerts</div>
          <div class="srow"><div><b>Notifications</b><small>${perm}</small></div>${perm === 'Allowed' || perm === 'Not supported' ? '' : '<button class="btn small" data-action="askNotify">Enable</button>'}</div>
          ${native ? `<div class="srow"><div><b>Exact alarms</b><small>${NB.perm.exact === 'granted' ? 'Allowed · rings right on time' : 'Not allowed · reminders may be late'}</small></div>${NB.perm.exact === 'granted' ? '' : '<button class="btn small" data-action="exactSettings">Allow</button>'}</div>` : ''}
          ${native && NB.geo && NB.geo.available ? `<div class="srow"><div><b>Location · place reminders</b><small>${geoTxt}</small></div>${NB.geo.bg ? '' : '<button class="btn small" data-action="askLocation">Allow</button>'}</div>` : ''}
          <div class="srow"><div><b>Keep screen on</b><small>While the app is open</small></div><label class="sw"><input type="checkbox" id="s-wake" ${state.settings.keepAwake ? 'checked' : ''}><span></span></label></div>
          <button class="btn ghost" style="width:100%" data-action="testRing">Test a ring</button>
          <div class="note">${native ? 'Reminders are handed to Android, so they ring with the screen off and Nudge closed. Open Nudge every couple of weeks so it can schedule further ahead.' : 'Alarms ring reliably while Nudge is open or recently used. Android can pause web apps in the background, so Nudge also catches up the moment you open it.'}</div>

          <div class="set-h">Install &amp; backup</div>
          ${standalone || native ? '' : `<div class="srow"><div><b>Install app</b><small>Or Chrome menu → Add to Home screen</small></div>${deferredPrompt ? '<button class="btn small" data-action="install">Install</button>' : ''}</div>`}
          <div style="display:flex;gap:8px"><button class="btn ghost small" data-action="exportData">Export backup</button><button class="btn ghost small" data-action="importData">Import backup</button></div>
          <input type="file" id="s-file" accept="application/json" hidden>
        </div>`);
      el.querySelectorAll('details.acc').forEach((d) => d.addEventListener('toggle', () => { if (d.open) openSecs.add(d.dataset.k); else openSecs.delete(d.dataset.k); }));
      el.querySelectorAll('[data-det]').forEach((i) => i.addEventListener('change', () => {
        state.settings.details = Object.assign({}, det(), { [i.dataset.det]: i.checked }); save(); renderMain();
      }));
      const fl = el.querySelector('#s-fill');
      fl.addEventListener('input', () => { state.settings.tagFill = Number(fl.value); document.documentElement.style.setProperty('--li-op', fl.value + '%'); el.querySelector('#s-fillv').textContent = fl.value + '%'; });
      fl.addEventListener('change', () => { save(); renderLists(); });
      const addT = () => { const i = el.querySelector('#s-tagin'); if (addSettingTag(i.value)) { renderMain(); showTop(); } };
      el.querySelector('#s-tagadd').addEventListener('click', addT);
      el.querySelector('#s-tagin').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); addT(); } });
      el.querySelector('#s-dark').addEventListener('change', (ev) => { state.settings.dark = ev.target.checked; save(); applyTheme(); renderMain(); });
      const nag = el.querySelector('#s-nag'); nag.addEventListener('change', () => { state.settings.defaultNag = Math.min(720, Math.max(1, Number(nag.value) || 10)); save(); });
      const snd = el.querySelector('#s-sound'); snd.addEventListener('change', () => { state.settings.defaultSound = snd.value; save(); playOnce(snd.value); });
      const wake = el.querySelector('#s-wake'); wake.addEventListener('change', () => { state.settings.keepAwake = wake.checked; save(); applyWake(); });
      el.querySelector('#s-file').addEventListener('change', importFile);
    };
    settingsRef = render; pushSheet(render);
  }

  function movePreset(id, dir) {
    const i = state.presets.findIndex((p) => p.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= state.presets.length) return;
    [state.presets[i], state.presets[j]] = [state.presets[j], state.presets[i]];
    save(); showTop();
  }

  function presetSheet(id) {
    const existing = id ? state.presets.find((p) => p.id === id) : null;
    const p = existing ? clone(existing) : { id: uid(), type: 'rel', amount: 30, unit: 'min' };
    pushSheet((el) => {
      const tomorrow = C.ymd(C.addDays(new Date(), 1));
      const fields = () => {
        if (p.type === 'rel') return `<div class="row2"><label class="fld"><span>Amount</span><input id="p-amount" type="number" min="1" max="999" inputmode="numeric" value="${p.amount}"></label>
          <label class="fld"><span>Unit</span><select id="p-unit">${[['min', 'Minutes'], ['hour', 'Hours'], ['day', 'Days'], ['week', 'Weeks']].map(([k, n]) => `<option value="${k}" ${p.unit === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
        if (p.type === 'at') return `<div class="row2"><label class="fld"><span>Day</span><select id="p-day"><option value="today" ${p.day === 'today' ? 'selected' : ''}>Today</option><option value="tomorrow" ${p.day === 'tomorrow' ? 'selected' : ''}>Tomorrow</option>${DAY_ORDER.map((d) => `<option value="${d}" ${String(p.day) === String(d) ? 'selected' : ''}>Next ${C.DAYS_FULL[d]}</option>`).join('')}</select></label>
          <label class="fld"><span>Time</span>${timeField('p-time', p.time || '09:00')}</label></div>`;
        return `<div class="row2"><label class="fld"><span>Date</span><input id="p-date" type="date" value="${esc(p.date || tomorrow)}"></label>
          <label class="fld"><span>Time</span>${timeField('p-time', p.time || '09:00')}</label></div>`;
      };
      el.innerHTML = `<div class="sheet-h"><h2>${existing ? 'Edit snooze' : 'New snooze'}</h2><button class="icon-btn" data-action="closeSheet" aria-label="Close">${ICON.close}</button></div>
        <div class="sheet-b">
          <div class="seg" id="p-type"><button data-t="rel" class="${p.type === 'rel' ? 'on' : ''}">From now</button><button data-t="at" class="${p.type === 'at' ? 'on' : ''}">Day &amp; time</button><button data-t="date" class="${p.type === 'date' ? 'on' : ''}">Exact date</button></div>
          <div id="p-fields">${fields()}</div>
          <label class="fld"><span>Name (optional)</span><input id="p-label" type="text" maxlength="24" placeholder="Auto" value="${esc(p.label || '')}"></label>
          <div class="next" id="p-prev" style="margin-top:6px"></div>
        </div>
        <div class="sheet-f"><button class="btn" id="p-save">Save</button></div>`;
      const $p = (s) => el.querySelector(s);
      const read = () => {
        if (p.type === 'rel') { p.amount = Math.max(1, Number($p('#p-amount')?.value) || 1); p.unit = $p('#p-unit')?.value || 'min'; }
        if (p.type === 'at') { p.day = $p('#p-day')?.value || 'tomorrow'; if (p.day !== 'today' && p.day !== 'tomorrow') p.day = Number(p.day); p.time = $p('#p-time')?.value || '09:00'; }
        if (p.type === 'date') { p.date = $p('#p-date')?.value || tomorrow; p.time = $p('#p-time')?.value || '09:00'; }
        p.label = $p('#p-label').value.trim();
      };
      const preview = () => {
        read(); const when = C.resolveSnooze(p, new Date());
        $p('#p-prev').innerHTML = when ? `Rings back <b>${esc(C.fmtWhen(when))}</b> · button reads <b>${esc(C.presetLabel(p))}</b>` : 'That date has already passed';
      };
      const bindFields = () => el.querySelectorAll('#p-fields input, #p-fields select').forEach((x) => x.addEventListener('input', preview));
      $p('#p-label').addEventListener('input', preview);
      $p('#p-type').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-t]'); if (!b || b.dataset.t === p.type) return;
        p.type = b.dataset.t;
        if (p.type === 'rel') { p.amount = 30; p.unit = 'min'; }
        if (p.type === 'at') { p.day = 'tomorrow'; p.time = '09:00'; }
        if (p.type === 'date') { p.date = tomorrow; p.time = '09:00'; }
        el.querySelectorAll('#p-type button').forEach((x) => x.classList.toggle('on', x === b));
        $p('#p-fields').innerHTML = fields(); bindFields(); preview();
      });
      $p('#p-save').addEventListener('click', () => {
        read();
        if (p.type === 'date' && !C.resolveSnooze(p, new Date())) { toast('Pick a date in the future'); return; }
        const i = state.presets.findIndex((x) => x.id === p.id);
        if (i >= 0) state.presets[i] = p; else state.presets.push(p);
        save(); closeSheet();
      });
      bindFields(); preview();
    });
  }

  /* ---------- backup ---------- */

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `nudge-backup-${C.ymd(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function importFile(ev) {
    const f = ev.target.files && ev.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.alarms)) throw new Error('bad');
        if (!confirm('Replace everything in Nudge with this backup?')) return;
        localStorage.setItem(KEY, JSON.stringify(d)); state = load(); state.lastTick = Date.now(); save();
        closeSheet(); afterChange(); toast('Backup restored');
      } catch (e) { toast('That file is not a Nudge backup'); }
    };
    r.readAsText(f); ev.target.value = '';
  }

  /* ---------- screen wake lock ---------- */

  let wl = null;
  async function applyWake() {
    try {
      if (state.settings.keepAwake && document.visibilityState === 'visible' && 'wakeLock' in navigator) {
        if (!wl) { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); }
      } else if (wl) { await wl.release(); wl = null; }
    } catch (e) { wl = null; }
  }

  /* ================= events ================= */

  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

  document.addEventListener('pointerdown', () => audio(), { once: true });

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-action]'); if (!t) return;
    const act = t.dataset.action; const pid = t.dataset.pid; const id = t.dataset.id;
    switch (act) {
      case 'done': done(pid); break;
      case 'dismiss': dismiss(pid); break;
      case 'snooze': snoozePreset(pid, t.dataset.preset); if (sheets.length) closeSheet(); break;
      case 'pickToggle': { const b = document.getElementById('pick-' + pid); if (b) b.hidden = !b.hidden; break; }
      case 'pickSet': {
        const v = document.getElementById('pickval-' + pid)?.value;
        const when = v ? new Date(v) : null;
        if (when && !isNaN(when) && when.getTime() > Date.now()) { snoozeTo(pid, when); if (sheets.length) closeSheet(); } else toast('Pick a time in the future');
        break;
      }
      case 'snoozeSheet': snoozeSheet(pid); break;
      case 'edit': editSheet(id); break;
      case 'palette': state.settings.palette = t.dataset.pal; save(); applyTheme(); renderMain(); showTop(); break;
      case 'tagHue': tagPick = tagPick === t.dataset.tag ? null : t.dataset.tag; showTop(); break;
      case 'tagSet': setTagHue(t.dataset.tag, Number(t.dataset.i)); tagPick = null; renderMain(); showTop(); break;
      case 'tagDel': if (confirm('Delete #' + t.dataset.tag + '? It is removed from every item and reminder.')) { deleteTag(t.dataset.tag); showTop(); } break;
      case 'tickItem': tickItem(id); break;
      case 'editItem': itemSheet(id); break;
      case 'selTag': { const g = t.dataset.tag; listSel = listSel.includes(g) ? listSel.filter((x) => x !== g) : [...listSel, g]; const v = $('#liIn') ? $('#liIn').value : ''; renderLists(); if (v) $('#liIn').value = v; break; }
      case 'toggleDone': doneOpen = !doneOpen; renderLists(); break;
      case 'clearDone': if (confirm('Remove all ticked items?')) { state.items.filter((x) => x.done).forEach((x) => removeItem(x.id)); } break;
      case 'sortToggle': state.settings.sortMode = state.settings.sortMode === 'clock' ? 'next' : 'clock'; save(); renderList(); toast(state.settings.sortMode === 'clock' ? 'Sorted by time of day' : 'Sorted by next due'); break;
      case 'tagFilter': tagFilter = t.dataset.tag || null; renderList(); break;
      case 'toggleArchive': archOpen = !archOpen; renderList(); break;
      case 'archiveAlarm': archiveAlarm(id); break;
      case 'reactivate': reactivate(id); break;
      case 'doneNext': doneNext(id); break;
      case 'delAlarm': deleteAlarm(id); break;
      case 'closeSheet': closeSheet(); break;
      case 'editPreset': presetSheet(id || null); break;
      case 'presetUp': movePreset(id, -1); break;
      case 'presetDown': movePreset(id, 1); break;
      case 'presetDel':
        if (state.presets.length <= 1) { toast('Keep at least one snooze option'); break; }
        state.presets = state.presets.filter((p) => p.id !== id); save(); showTop(); break;
      case 'presetReset':
        if (confirm('Reset the snooze menu to the defaults?')) { state.presets = C.defaultPresets(); save(); showTop(); }
        break;
      case 'askNotify': askNotify().then(showTop); break;
      case 'syncOn': window.NudgeSync.connect(); break;
      case 'syncNow': window.NudgeSync.syncNow(); break;
      case 'syncCancel': window.NudgeSync.cancel(); break;
      case 'syncOff': if (confirm('Stop syncing on this device? Your reminders stay here and in Drive.')) { window.NudgeSync.disconnect(); showTop(); } break;
      case 'askLocation': askLocation().then(() => { const NB = window.NativeBridge; if (NB.geo && !NB.geo.bg && NB.openAppSettings) NB.openAppSettings(); showTop(); }); break;
      case 'exactSettings': window.NativeBridge.openExactSettings().then(showTop); break;
      case 'testRing': {
        closeSheet();
        state.pending = state.pending.filter((p) => p.alarmId !== 'test');
        state.pending.push({ id: uid(), alarmId: 'test', label: 'Test reminder', color: COLORS[2], sound: state.settings.defaultSound, persistent: false, nag: state.settings.defaultNag, firedAt: Date.now(), nextRingAt: Date.now(), mode: 'ring' });
        save(); setTimeout(afterChange, 60); break;
      }
      case 'install': if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } break;
      case 'exportData': exportData(); break;
      case 'importData': document.getElementById('s-file')?.click(); break;
      default: break;
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset && t.dataset.action === 'toggle') {
      const a = state.alarms.find((x) => x.id === t.dataset.id); if (!a) return;
      a.enabled = t.checked;
      if (a.enabled && !a.loc && !(a.days && a.days.length)) {
        const now = new Date();
        if (!a.date || C.atTime(C.parseYmd(a.date), a.time) <= now) a.date = C.nextOneOffDate(a.time, now);
      }
      state.lastTick = Date.now(); save(); renderMain();
    }
  });

  $('#fab').addEventListener('click', () => (tab === 'lists' ? itemSheet(null) : editSheet(null)));
  $('#btnSettings').addEventListener('click', settingsSheet);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { tick(); applyWake(); renderMain(); pollGeo(); }
  });
  window.addEventListener('focus', tick);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'notif') handleExternalAction(e.data.action, e.data.pid);
    });
  }

  /* ================= boot ================= */

  function boot() {
    if ('serviceWorker' in navigator) {
      if (isNative()) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
      else navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    const q = new URLSearchParams(location.search);
    if (q.get('action')) { handleExternalAction(q.get('action'), q.get('pid')); history.replaceState({}, '', location.pathname); }
    renderMain(); tick(); applyWake();
    if (window.NudgeSync) window.NudgeSync.init({ state: () => state, save, persist: () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }, rerender: () => { applyTheme(); renderMain(); syncRing(); }, onStatus: () => { if (sheets.length && sheets[sheets.length - 1] === settingsRef) showTop(); } });
    setInterval(tick, 1000);
    let lastDay = new Date().getDate();
    setInterval(() => { renderToday(); renderNext(); renderNeeds(); if (new Date().getDate() !== lastDay) { lastDay = new Date().getDate(); renderList(); } }, 30000);
    if (isNative()) { setTimeout(pollGeo, 1200); setInterval(pollGeo, 10000); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pollGeo(); }); }
  }
  window.NudgeApp = { getState: () => state, save, tick, fromNotification, handleExternalAction };
  boot();
})();
