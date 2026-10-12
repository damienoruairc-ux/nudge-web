/* Nudge native layer (Android app only).
   In the Android app this hands every upcoming ring and nag to Android's alarm system, so they fire
   with the screen off and the app closed. In a normal browser this file does nothing. */
(function () {
  'use strict';
  const NB = {
    isNative: false,
    perm: { notif: 'unknown', exact: 'unknown' },
    refreshPerm: async () => NB.perm,
    ensurePermissions: async () => NB.perm,
    openExactSettings: async () => {},
    changed: () => {},
    clearDelivered: () => {},
  };
  window.NativeBridge = NB;

  const Cap = window.Capacitor;
  const LN = Cap && Cap.isNativePlatform && Cap.isNativePlatform() && Cap.Plugins && Cap.Plugins.LocalNotifications;
  if (!LN) return;
  NB.isNative = true;

  const C = window.Core;
  const SOUNDS = { pulse: 'Pulse', chime: 'Chime', blip: 'Blip', drop: 'Drop', pluck: 'Pluck', soft: 'Soft', beacon: 'Beacon', none: 'Vibrate only' };
  const CHANNEL_VERSION = 'v1'; // Android freezes a channel's sound; bump this if the sound files ever change
  const chanId = (s) => `nudge-${CHANNEL_VERSION}-${SOUNDS[s] ? s : 'pulse'}`;
  const app = () => window.NudgeApp;

  /* ---------- notification ids ---------- */
  const idMap = new Map();
  function idFor(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    let id = (h >>> 0) & 0x7fffffff;
    if (id === 0) id = 1;
    while (idMap.has(id) && idMap.get(id) !== key) id = (id + 1) & 0x7fffffff || 1;
    idMap.set(id, key);
    return id;
  }

  /* ---------- permissions ---------- */
  async function refreshPerm() {
    try { NB.perm.notif = (await LN.checkPermissions()).display; } catch (e) { /* ignore */ }
    try { NB.perm.exact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch (e) { /* ignore */ }
    return NB.perm;
  }
  async function ensurePermissions() {
    try {
      const p = await LN.checkPermissions();
      if (p.display === 'prompt' || p.display === 'prompt-with-rationale') await LN.requestPermissions();
    } catch (e) { /* ignore */ }
    await refreshPerm();
    if (NB.perm.notif === 'granted') NB.changed();
    return NB.perm;
  }
  async function openExactSettings() {
    try { await LN.changeExactNotificationSetting(); } catch (e) { /* ignore */ }
    await refreshPerm();
  }

  /* ---------- one-time setup: channels + action buttons ---------- */
  let channelsDone = false;
  async function setupChannels() {
    if (channelsDone) return;
    for (const [k, name] of Object.entries(SOUNDS)) {
      const ch = { id: chanId(k), name: `Nudge · ${name}`, description: 'Reminder alerts', importance: 5, visibility: 1, vibration: true, lights: true, lightColor: '#00F0FF' };
      if (k !== 'none') ch.sound = `${k}.wav`;
      try { await LN.createChannel(ch); } catch (e) { /* ignore */ }
    }
    channelsDone = true;
  }
  async function setupActions(presets) {
    const actions = [{ id: 'done', title: 'Done' }];
    if (presets && presets[0]) actions.push({ id: 'snooze', title: 'Snooze ' + C.presetLabel(presets[0]) });
    try { await LN.registerActionTypes({ types: [{ id: 'NUDGE', actions }] }); } catch (e) { /* ignore */ }
  }

  /* ---------- plan -> Android notifications ---------- */
  function bodyFor(it) {
    const t = C.hhmm(new Date(it.firedAt));
    if (it.kind === 'nag') return `Still waiting · ${t}`;
    if (it.kind === 'snooze') return `Snooze over · ${t}`;
    return t + (it.persistent ? ' · keeps ringing until Done' : '');
  }
  function toLN(it, exactOK) {
    return {
      id: idFor(it.key),
      title: it.label || 'Reminder',
      body: bodyFor(it),
      channelId: chanId(it.sound),
      schedule: { at: new Date(it.at), allowWhileIdle: true },
      actionTypeId: 'NUDGE',
      extra: { alarmId: it.alarmId, pid: it.pid || null, firedAt: it.firedAt, kind: it.kind },
      smallIcon: 'ic_stat_nudge',
      iconColor: it.color || '#00F0FF',
      autoCancel: true,
      foreground: true,
      isExactNotification: !!exactOK,
    };
  }

  async function doSync() {
    if (!app()) return;
    try { await syncFences(); } catch (e) { console.warn('Nudge geofence sync failed', e); }
    await refreshPerm();
    if (NB.perm.notif !== 'granted') return;
    const st = app().getState();
    await setupChannels();
    await setupActions(st.presets);
    const pend = await LN.getPending();
    if (pend && pend.notifications && pend.notifications.length) {
      await LN.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
    }
    idMap.clear();
    const plan = C.nativePlan(st, Date.now());
    if (plan.length) await LN.schedule({ notifications: plan.map((it) => toLN(it, NB.perm.exact === 'granted')) });
    NB.lastPlanCount = plan.length;
  }

  /* ---------- place reminders (Android geofences) + voice ---------- */
  const GF = (Cap.Plugins && Cap.Plugins.NudgeGeofence) || (Cap.registerPlugin && Cap.registerPlugin('NudgeGeofence'));
  NB.geo = { available: !!GF, fg: false, bg: false };
  NB.geoStatus = async () => {
    if (!GF) return NB.geo;
    try { const s = await GF.status(); NB.geo.fg = !!s.foreground; NB.geo.bg = !!s.background; } catch (e) { /* ignore */ }
    return NB.geo;
  };
  NB.ensureLocation = async () => {
    if (!GF) return NB.geo;
    try {
      await GF.requestForeground(); await NB.geoStatus();
      if (NB.geo.fg && !NB.geo.bg) await GF.requestBackground();
    } catch (e) { /* ignore */ }
    await NB.geoStatus(); NB.changed();
    return NB.geo;
  };
  NB.openAppSettings = async () => { try { await GF.openAppSettings(); } catch (e) { /* ignore */ } };
  NB.speak = async () => { const r = await GF.speak(); return (r && r.text) || ''; };
  NB.consumeFired = async () => {
    if (!GF) return [];
    try { const r = await GF.consumeFired(); return (r && r.fired) || []; } catch (e) { return []; }
  };
  function fencesOf(st) {
    return (st.alarms || []).filter((a) => a.enabled && !a.archived && a.loc).map((a) => ({
      id: a.id, lat: a.loc.lat, lon: a.loc.lon, radius: a.loc.radius || 200, label: a.label || 'Reminder', place: a.loc.name || '',
      sound: SOUNDS[a.sound] ? a.sound : 'pulse', color: a.color || '#00F0FF', persistent: !!a.persistent, nag: a.nag || 10, repeat: !!a.locRepeat,
    }));
  }
  async function syncFences() {
    if (!GF || !app()) return;
    await GF.setGeofences({ fences: fencesOf(app().getState()) });
  }
  NB.fencesOf = fencesOf;

  /* ---------- serialised, debounced sync ---------- */
  let timer = null; let busy = false; let again = false;
  async function run() {
    if (busy) { again = true; return; }
    busy = true;
    try { await doSync(); } catch (e) { console.warn('Nudge native sync failed', e); } finally { busy = false; if (again) { again = false; run(); } }
  }
  NB.changed = () => { clearTimeout(timer); timer = setTimeout(run, 350); };

  NB.clearDelivered = () => { try { LN.removeAllDeliveredNotifications(); } catch (e) { /* ignore */ } };
  NB.refreshPerm = refreshPerm;
  NB.ensurePermissions = ensurePermissions;
  NB.openExactSettings = openExactSettings;
  NB.flush = run; // used by tests

  /* ---------- events from Android ---------- */
  LN.addListener('localNotificationActionPerformed', (ev) => {
    const x = (ev && ev.notification && ev.notification.extra) || {};
    if (app() && app().fromNotification) app().fromNotification(ev.actionId, x);
  });
  // The app is open and handles rings itself, so take the system notification away when it arrives.
  LN.addListener('localNotificationReceived', (n) => {
    if (document.visibilityState === 'visible' && n && n.id != null) {
      setTimeout(() => { try { LN.removeDeliveredNotifications({ notifications: [{ id: n.id }] }); } catch (e) { /* ignore */ } }, 250);
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { NB.clearDelivered(); refreshPerm().then(() => NB.changed()); }
  });

  // initial pass once the app has booted
  setTimeout(() => { NB.clearDelivered(); refreshPerm().then(() => NB.changed()); NB.geoStatus(); }, 800);
})();
