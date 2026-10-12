/* Nudge core: pure scheduling + snooze logic (no DOM). Works in browser and Node. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Core = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');

  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const atTime = (day, t) => {
    const [h, m] = t.split(':').map(Number);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
  };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  /* ---------- reminders ---------- */

  // Whole days since 1970 for a local calendar date, and the week number (weeks start Monday).
  const dayNum = (d) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  const weekNo = (d) => Math.floor((dayNum(d) - ((d.getDay() + 6) % 7)) / 7);

  // Does reminder `a` fall on this calendar day? (day-of-week, and every-N-weeks from its start date)
  function matchesDay(a, t) {
    const days = a.days || [];
    if (!days.length) return a.date === ymd(t);
    if (!days.includes(t.getDay())) return false;
    const every = Math.max(1, Number(a.every) || 1);
    if (every > 1) {
      const start = a.start ? parseYmd(a.start) : null;
      if (start) {
        if (ymd(t) < a.start) return false;
        if ((weekNo(t) - weekNo(start)) % every !== 0) return false;
      }
    }
    return true;
  }

  // All firing moments of reminder `a` in the window (from, to].
  function occurrences(a, from, to) {
    const out = [];
    if (!a || !a.time) return out;
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    let guard = 0;
    while (d <= to && guard++ < 60) {
      const t = atTime(d, a.time);
      if (matchesDay(a, t) && t > from && t <= to) out.push(t);
      d.setDate(d.getDate() + 1);
    }
    return out;
  }

  function nextOccurrence(a, from) {
    if (!a || !a.time) return null;
    if (!(a.days && a.days.length)) {
      if (!a.date) return null;
      const t = atTime(parseYmd(a.date), a.time);
      return t > from ? t : null;
    }
    return occurrences(a, from, addDays(from, 16))[0] || null;
  }

  // Date (YYYY-MM-DD) a one-off reminder at `time` should use: today if still ahead, else tomorrow.
  function nextOneOffDate(time, now) {
    const t = atTime(now, time);
    return ymd(t > now ? now : addDays(now, 1));
  }

  function repeatLabel(a) {
    const days = (a.days || []).slice().sort((x, y) => x - y);
    if (!days.length) {
      if (!a.date) return 'Once';
      const d = parseYmd(a.date);
      return `Once · ${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    }
    const every = Math.max(1, Number(a.every) || 1);
    const names = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAYS[d]).join(' ');
    if (every > 1) return `Every ${every} weeks · ${names}`;
    if (days.length === 7) return 'Every day';
    if (days.join() === '1,2,3,4,5') return 'Weekdays';
    if (days.join() === '0,6') return 'Weekends';
    return names;
  }

  /* ---------- snooze presets ---------- */

  const UNIT_MS = { min: 60000, hour: 3600000 };

  // Returns a Date (when the reminder should ring again) or null if the preset can't resolve (e.g. a date in the past).
  function resolveSnooze(p, now) {
    now = now || new Date();
    if (p.type === 'rel') {
      const n = Math.max(1, Number(p.amount) || 1);
      if (p.unit === 'min' || p.unit === 'hour') return new Date(now.getTime() + n * UNIT_MS[p.unit]);
      if (p.unit === 'day') return addDays(now, n);
      if (p.unit === 'week') return addDays(now, 7 * n);
      return null;
    }
    if (p.type === 'at') {
      if (p.day === 'today') {
        const t = atTime(now, p.time);
        return t > now ? t : atTime(addDays(now, 1), p.time);
      }
      if (p.day === 'tomorrow') return atTime(addDays(now, 1), p.time);
      const wd = Number(p.day);
      let diff = (wd - now.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      return atTime(addDays(now, diff), p.time);
    }
    if (p.type === 'date') {
      if (!p.date) return null;
      const t = atTime(parseYmd(p.date), p.time || '09:00');
      return t > now ? t : null;
    }
    return null;
  }

  function presetLabel(p) {
    if (p.label && p.label.trim()) return p.label.trim();
    if (p.type === 'rel') {
      const n = Math.max(1, Number(p.amount) || 1);
      const u = { min: 'min', hour: n === 1 ? 'hour' : 'hours', day: n === 1 ? 'day' : 'days', week: n === 1 ? 'week' : 'weeks' }[p.unit] || p.unit;
      return `${n} ${u}`;
    }
    if (p.type === 'at') {
      if (p.day === 'today') return `Today ${p.time}`;
      if (p.day === 'tomorrow') return `Tomorrow ${p.time}`;
      return `Next ${DAYS[Number(p.day)]} ${p.time}`;
    }
    if (p.type === 'date') {
      if (!p.date) return 'Pick a date';
      const d = parseYmd(p.date);
      return `${d.getDate()} ${MONTHS[d.getMonth()]} ${p.time || ''}`.trim();
    }
    return 'Snooze';
  }

  function defaultPresets() {
    return [
      { id: 'p1', type: 'rel', amount: 15, unit: 'min' },
      { id: 'p2', type: 'rel', amount: 1, unit: 'hour' },
      { id: 'p3', type: 'at', day: 'today', time: '18:00', label: 'This evening' },
      { id: 'p4', type: 'at', day: 'tomorrow', time: '08:00' },
      { id: 'p5', type: 'at', day: 4, time: '09:00' },
      { id: 'p6', type: 'rel', amount: 1, unit: 'week' },
    ];
  }

  /* ---------- formatting ---------- */

  function fmtWhen(date, now) {
    now = now || new Date();
    if (ymd(date) === ymd(now)) return `Today ${hhmm(date)}`;
    if (ymd(date) === ymd(addDays(now, 1))) return `Tomorrow ${hhmm(date)}`;
    const days = (atTime(date, '00:00') - atTime(now, '00:00')) / 864e5;
    if (days > 0 && days < 7) return `${DAYS[date.getDay()]} ${hhmm(date)}`;
    return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]} ${hhmm(date)}`;
  }

  function fmtDelta(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return 'under a minute';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
    const d = Math.floor(h / 24);
    return h % 24 ? `${d}d ${h % 24}h` : `${d}d`;
  }


  /* ---------- quick entry: "call the doctor next tuesday at 3pm" ---------- */

  const WD = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  const WD_FULL = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)';
  const WD_ABBR = '(?:sun|mon|tues|tue|wed|thurs|thur|thu|fri|sat)';
  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, sixty: 60 };
  const NUMNC = '(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)';
  const NUM_RE = '(\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|sixty)';
  const numOf = (x) => (/^\d+$/.test(x) ? Number(x) : NUMW[x.toLowerCase()] || 1);
  const wdOf = (x) => WD[x.slice(0, 3).toLowerCase()];

  function nextWeekday(now, wd, forceNext, timeStr) {
    let diff = (wd - now.getDay() + 7) % 7;
    if (diff === 0) {
      const passed = timeStr ? atTime(now, timeStr) <= now : false;
      if (forceNext || passed) diff = 7;
    }
    return addDays(now, diff);
  }

  // Turns a sentence into { title, time, date, days, every, start, tags, place, when }.
  // `when` is true when a time/date/repeat was found. Timings are removed from the title.
  function parseQuick(input, now) {
    now = now || new Date();
    let w = ' ' + String(input || '').replace(/\s+/g, ' ').trim() + ' ';
    const out = { title: '', time: null, date: null, days: [], every: 1, start: null, tags: [], place: null, when: false };
    const take = (re, fn) => { const m = w.match(re); if (!m) return false; w = w.replace(re, ' '); fn(m); return true; };

    // filler at the start
    w = w.replace(/^\s*(?:please\s+)?(?:remind me|reminder|remember|set (?:a )?reminder|don'?t forget)\s*(?:to|about|that|for)?\s+/i, ' ');

    // #tags
    w = w.replace(/(^|\s)#([a-z0-9][a-z0-9_-]*)/gi, (m, sp, t) => { out.tags.push(t.toLowerCase()); return ' '; });

    // places: "when I get to Tesco", "when I arrive at the school"
    take(/\b(?:when|as soon as|once|next time)\s+(?:i|we)\s*(?:'m|am)?\s*(?:get|got|arrive|arrived|reach|reached|come|walk|drive|am|are|is)?\s*(?:to|at|into|in|near|by)\s+(?:the\s+)?([^,.;#]+?)(?=\s+(?:and|then|but|so)\b|[,.;#]|\s*$)/i,
      (m) => { out.place = m[1].trim(); });
    if (!out.place) take(/\b(?:on arrival at|arriving at|arriving in|on arriving at|near)\s+(?:the\s+)?([^,.;#]+?)(?=\s+(?:and|then|but|so)\b|[,.;#]|\s*$)/i, (m) => { out.place = m[1].trim(); });

    // ---- repeats ----
    let every = 1; let days = []; let weekly = false;
    if (take(new RegExp(`\\bevery\\s+(?:other|second)\\s+(${WD_FULL}|${WD_ABBR})s?\\b`, 'i'), (m) => { every = 2; weekly = true; days = [wdOf(m[1])]; })) { /* every other wednesday */ }
    else if (take(/\b(?:every\s+(?:other|second)\s+week|fortnightly|every\s+(?:2|two)\s+weeks?|bi-?weekly)\b/i, () => { every = 2; weekly = true; })) { /* every 2 weeks */ }
    else if (take(/\b(?:every\s+week|weekly|each\s+week)\b/i, () => { weekly = true; })) { /* weekly */ }
    if (take(/\b(?:every\s*day|daily|each\s+day|everyday)\b/i, () => { days = [0, 1, 2, 3, 4, 5, 6]; })) { /* daily */ }
    else if (take(/\b(?:every\s+week\s*day|on\s+week\s*days|week\s*days)\b/i, () => { days = [1, 2, 3, 4, 5]; })) { /* weekdays */ }
    else if (take(/\b(?:every\s+weekend|on\s+weekends|weekends)\b/i, () => { days = [0, 6]; })) { /* weekends */ }
    else {
      const lst = new RegExp(`\\bevery\\s+((?:(?:${WD_FULL}|${WD_ABBR})s?(?:\\s*(?:,|and|&)\\s*)?)+)`, 'i');
      take(lst, (m) => { (m[1].match(new RegExp(`${WD_FULL}|${WD_ABBR}`, 'gi')) || []).forEach((n) => { const d = wdOf(n); if (!days.includes(d)) days.push(d); }); });
    }
    const repeating = days.length > 0 || weekly;

    // ---- time ----
    let hh = null; let mm = 0; let rel = null; let bare = false;
    if (take(new RegExp(`\\b(?:in|after)\\s+(half an?|${NUMNC})\\s*(minutes?|mins?|hours?|hrs?|h)\\b`, 'i'), (m) => {
      const half = /^half/i.test(m[1]); const n = half ? 0.5 : numOf(m[1]); const hour = /^h/i.test(m[2]);
      rel = Math.round(n * (hour ? 60 : 1) * 60000);
    })) { /* relative time */ }
    else if (take(/\b(?:at\s+|by\s+|around\s+|@\s*)?(noon|midday|midnight)\b/i, (m) => { hh = /midnight/i.test(m[1]) ? 0 : 12; mm = 0; })) { /* named time */ }
    else if (take(/\b(?:at\s+|by\s+|around\s+|@\s*)?(\d{1,2})[:.](\d{2})\s*(a\.?m\.?|p\.?m\.?)?(?![\d])/i, (m) => {
      const ap = (m[3] || '').toLowerCase().replace(/\./g, ''); hh = Number(m[1]); mm = Number(m[2]);
      if (ap === 'pm' && hh < 12) hh += 12; if (ap === 'am' && hh === 12) hh = 0;
    })) { /* 3:30pm / 15:00 */ }
    else if (take(/\b(?:at\s+|by\s+|around\s+|@\s*)?(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/i, (m) => {
      const ap = m[2].toLowerCase().replace(/\./g, ''); hh = Number(m[1]); mm = 0;
      if (ap === 'pm' && hh < 12) hh += 12; if (ap === 'am' && hh === 12) hh = 0;
    })) { /* 3pm */ }
    else if (take(/\b(?:at|@)\s*(\d{1,2})(?![\d:/.-]|\s*(?:st|nd|rd|th|o'?clock\s+tomorrow\b))(?:\s*o'?clock)?\b/i, (m) => { hh = Number(m[1]); mm = 0; bare = true; })) { /* at 3 */ }
    if (hh !== null && (hh > 23 || mm > 59)) { hh = null; }

    // part-of-day words (only if no clock time was given)
    let part = null; let partToday = false;
    take(/\b(?:this\s+)?(tonight|this\s+evening|this\s+morning|this\s+afternoon|in\s+the\s+morning|in\s+the\s+afternoon|in\s+the\s+evening|at\s+lunch(?:\s*time)?|lunch\s*time|end\s+of\s+(?:the\s+)?day|eod|morning|afternoon|evening|night)\b/i, (m) => {
      const k = m[1].toLowerCase().replace(/\s+/g, ' ');
      part = /tonight/.test(k) ? '20:00' : /night/.test(k) ? '21:00' : /evening/.test(k) ? '18:00' : /afternoon/.test(k) ? '15:00' : /morning/.test(k) ? '09:00' : /lunch/.test(k) ? '12:30' : '17:00';
      partToday = /^this |tonight/.test(k);
    });

    // ---- date ----
    let date = null; let forceNextWeekday = false; let dateFound = false;
    const timeStrNow = hh !== null ? `${pad(hh)}:${pad(mm)}` : part;
    if (take(/\b(day after tomorrow)\b/i, () => { date = addDays(now, 2); })) dateFound = true;
    else if (take(/\b(today|tonight|tomorrow|tmrw|tmw|2moro)\b/i, (m) => {
      const k = m[1].toLowerCase(); date = k === 'today' ? now : k === 'tonight' ? now : addDays(now, 1);
      if (k === 'tonight' && !part && hh === null) part = '20:00';
    })) dateFound = true;
    else if (take(new RegExp(`\\bin\\s+${NUM_RE}\\s+(days?|weeks?|months?)\\b`, 'i'), (m) => {
      const n = numOf(m[1]); const u = m[2].toLowerCase();
      if (u.startsWith('day')) date = addDays(now, n); else if (u.startsWith('week')) date = addDays(now, 7 * n);
      else { date = new Date(now.getFullYear(), now.getMonth() + n, now.getDate()); }
    })) dateFound = true;
    else if (take(/\b(?:next|this coming)\s+(week|month)\b/i, (m) => {
      date = /week/i.test(m[1]) ? addDays(now, 7) : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
    })) dateFound = true;
    else if (take(new RegExp(`\\b(?:(on|next|this|coming)\\s+)?(${WD_FULL})\\b`, 'i'), (m) => { forceNextWeekday = /^next$/i.test(m[1] || '') && false; date = nextWeekday(now, wdOf(m[2]), false, timeStrNow); out._wd = wdOf(m[2]); })) dateFound = true;
    else if (take(new RegExp(`\\b(on|next|this|coming)\\s+(${WD_ABBR})\\b`, 'i'), (m) => { date = nextWeekday(now, wdOf(m[2]), false, timeStrNow); out._wd = wdOf(m[2]); })) dateFound = true;
    else if (take(new RegExp(`\\b(?:on\\s+)?(?:the\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}(?:,?\\s+(\\d{4}))?\\b`, 'i'), (m) => {
      date = fromMD(now, MON[m[2].slice(0, 3).toLowerCase()], Number(m[1]), m[3]);
    })) dateFound = true;
    else if (take(new RegExp(`\\b(?:on\\s+)?${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i'), (m) => {
      date = fromMD(now, MON[m[1].slice(0, 3).toLowerCase()], Number(m[2]), m[3]);
    })) dateFound = true;
    else if (take(/\b(?:on\s+)?(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/, (m) => {
      date = fromMD(now, Number(m[2]) - 1, Number(m[1]), m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : undefined);
    })) dateFound = true;
    else if (take(/\b(?:on\s+)(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)\b/i, (m) => {
      const d = Number(m[1]);
      let t = new Date(now.getFullYear(), now.getMonth(), d);
      if (t < new Date(now.getFullYear(), now.getMonth(), now.getDate())) t = new Date(now.getFullYear(), now.getMonth() + 1, d);
      date = t;
    })) dateFound = true;

    // "at 3" with no am/pm: pick the sensible one
    if (bare && hh !== null) {
      if (hh >= 1 && hh <= 12) {
        if (dateFound && ymd(date) !== ymd(now)) hh = hh >= 7 && hh <= 11 ? hh : (hh === 12 ? 12 : hh + 12);
        else {
          const pm = hh === 12 ? 12 : hh + 12; const am = hh === 12 ? 0 : hh;
          const cand = [am, pm].filter((h) => atTime(date || now, `${pad(h)}:00`) > now);
          hh = cand.length ? cand[0] : (hh >= 7 && hh <= 11 ? hh : (hh === 12 ? 12 : hh + 12));
        }
      }
    }

    // ---- assemble ----
    let time = hh !== null ? `${pad(hh)}:${pad(mm)}` : part;
    if (rel !== null) {
      const t = new Date(now.getTime() + rel); date = t; time = hhmm(t); dateFound = true;
    }
    if (repeating) {
      out.every = every;
      if (days.length) out.days = days;
      else {
        const wd = out._wd !== undefined ? out._wd : (date || now).getDay();
        out.days = [wd];
      }
      if (every > 1 || (weekly && !days.length)) {
        let base = date;
        if (!base && days.length) base = days.map((d) => nextWeekday(now, d, false, out.time || time || '09:00')).sort((x, y) => x - y)[0];
        out.start = ymd(base || now);
      }
      if (every === 1 && !weekly) out.start = null;
      out.time = time || '09:00';
      out.date = null; out.when = true;
    } else if (time || dateFound) {
      out.time = time || '09:00';
      let d = date;
      if (!d) d = atTime(now, out.time) > now ? now : addDays(now, 1);
      out.date = ymd(d); out.when = true;
      if (partToday && !dateFound) out.date = ymd(atTime(now, out.time) > now ? now : addDays(now, 1));
    }
    delete out._wd;

    // ---- title ----
    let t = w.replace(/\s+/g, ' ').trim();
    const dangling = /\s+(?:on|at|by|for|next|this|in|every|from|starting|and|then|the|to|@|-|,)$/i;
    for (let i = 0; i < 4; i++) t = t.replace(dangling, '').trim();
    t = t.replace(/^(?:to|that|about|and|then)\s+/i, '').replace(/^[\s,.;:!-]+|[\s,.;:-]+$/g, '').trim();
    out.title = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    return out;
  }

  function fromMD(now, month, day, year) {
    const y = year ? Number(year) : now.getFullYear();
    let d = new Date(y, month, day);
    if (!year && d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) d = new Date(y + 1, month, day);
    return d;
  }

  /* ---------- native (Android) alarm plan ---------- */

  // Which Android notifications should exist right now, given the app state.
  // Pure function: the Android layer cancels everything and re-schedules this list on every change.
  const NEVER = 9e15;
  const chainFor = (nag) => Math.min(24, Math.floor(240 / Math.max(1, nag || 10)));

  function nativePlan(state, nowMs, opts) {
    const o = Object.assign({ horizonDays: 21, maxPerAlarm: 30, maxTotal: 300, laterChain: 2, minLeadMs: 2000 }, opts || {});
    const out = [];
    const now = new Date(nowMs);
    const horizon = new Date(nowMs + o.horizonDays * 864e5);
    const nagMs = (n) => Math.max(1, n || 10) * 60000;

    // 1) upcoming occurrences of enabled reminders (+ nag chain for persistent ones)
    for (const a of state.alarms || []) {
      if (!a.enabled) continue;
      const meta = { alarmId: a.id, label: a.label, sound: a.sound, color: a.color, persistent: !!a.persistent, nag: a.nag || 10 };
      occurrences(a, now, horizon).slice(0, o.maxPerAlarm).forEach((t, i) => {
        const at = t.getTime();
        out.push(Object.assign({ key: `a:${a.id}:${at}:0`, at, kind: 'ring', firedAt: at }, meta));
        if (a.persistent) {
          const n = i === 0 ? chainFor(a.nag) : o.laterChain;
          for (let k = 1; k <= n; k++) out.push(Object.assign({ key: `a:${a.id}:${at}:${k}`, at: at + k * nagMs(a.nag), kind: 'nag', firedAt: at }, meta));
        }
      });
    }

    // 2) things already fired and waiting on you (snoozed, nagging, or ringing right now)
    for (const p of state.pending || []) {
      if (p.nextRingAt >= NEVER) continue; // "missed" items stay silent
      const dueNow = p.nextRingAt <= nowMs;
      const start = dueNow ? nowMs : p.nextRingAt;
      const meta = { pid: p.id, alarmId: p.alarmId, label: p.label, sound: p.sound, color: p.color, persistent: !!p.persistent, nag: p.nag || 10, firedAt: p.firedAt };
      if (!dueNow) out.push(Object.assign({ key: `p:${p.id}:${start}:0`, at: start, kind: p.mode === 'snooze' ? 'snooze' : 'nag' }, meta));
      if (p.persistent) {
        for (let k = 1; k <= chainFor(p.nag); k++) out.push(Object.assign({ key: `p:${p.id}:${start}:${k}`, at: start + k * nagMs(p.nag), kind: 'nag' }, meta));
      }
    }

    return out.filter((x) => x.at > nowMs + o.minLeadMs).sort((x, y) => x.at - y.at).slice(0, o.maxTotal);
  }

  return {
    DAYS, DAYS_FULL, MONTHS, pad, ymd, hhmm, parseYmd, atTime, addDays,
    occurrences, nextOccurrence, nextOneOffDate, repeatLabel, matchesDay,
    resolveSnooze, presetLabel, defaultPresets, fmtWhen, fmtDelta,
    nativePlan, chainFor, parseQuick,
  };
});
