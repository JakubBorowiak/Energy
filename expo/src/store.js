// Energy — logika danych (port z prototypu webowego)
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DOPAMINE_PRESETS = ['Instagram', 'TikTok', 'YouTube', 'Reddit', 'X/Twitter', 'Gry', 'Jedzenie'];
export const TRIGGERS = ['nuda', 'stres', 'unikanie zadania', 'zmęczenie', 'samotność', 'nawyk/automat', 'nagroda'];

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const isoOf = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const uid = () => Math.random().toString(36).slice(2, 9);
export const nowHM = () => new Date().toTimeString().slice(0, 5);

export const DEFAULT_STATE = {
  habits: [
    { id: 'h1', type: 'good', name: 'Trening / ruch' },
    { id: 'h2', type: 'good', name: 'Czytanie 20 min' },
    { id: 'h3', type: 'good', name: 'Bez telefonu pierwsza godzina' },
    { id: 'b1', type: 'bad', name: 'Bezmyślne scrollowanie' },
    { id: 'b2', type: 'bad', name: 'Cukier / fast food' },
    { id: 'w1', type: 'weekly', name: 'Siłownia', target: 4 },
  ],
  supps: [
    { id: 's1', name: 'Magnez', defaultTime: '21:00' },
    { id: 's2', name: 'Omega-3', defaultTime: '08:00' },
    { id: 's3', name: 'Ashwagandha', defaultTime: '21:00' },
    { id: 's4', name: 'Witamina D', defaultTime: '08:00' },
  ],
  logs: {},
};

const KEY = 'energy_v1';

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.habits) return s;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export async function persist(state) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {}
}

export function logFor(state, date) {
  if (!state.logs[date]) state.logs[date] = { habits: {}, supps: {}, extras: [], ratings: {}, incidents: [], notes: {} };
  const l = state.logs[date];
  l.habits = l.habits || {};
  l.supps = l.supps || {};
  l.extras = l.extras || [];
  l.ratings = l.ratings || {};
  l.incidents = l.incidents || [];
  l.notes = l.notes || {};
  return l;
}

/* ---------- STREAKI ---------- */
export function goodStreak(state, habitId, fromDate) {
  let n = 0;
  const d = new Date(fromDate);
  const today = todayISO();
  for (let i = 0; i < 400; i++) {
    const iso = isoOf(d);
    const l = state.logs[iso];
    if (l && l.habits && l.habits[habitId] === true) n++;
    else if (iso !== today) break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export function badCleanStreak(state, habitId, fromDate) {
  let n = 0;
  const d = new Date(fromDate);
  for (let i = 0; i < 400; i++) {
    const iso = isoOf(d);
    const l = state.logs[iso];
    if (l && l.habits && l.habits[habitId] === true) break;
    n++;
    d.setDate(d.getDate() - 1);
    if (n > 365) break;
  }
  return n;
}
export function weeklyCount(state, habitId, fromDate) {
  let c = 0;
  const d = new Date(fromDate);
  for (let i = 0; i < 7; i++) {
    const iso = isoOf(d);
    const l = state.logs[iso];
    if (l && l.habits && l.habits[habitId] === true) c++;
    d.setDate(d.getDate() - 1);
  }
  return c;
}

/* ---------- KORELACJE ---------- */
export function pearson(pairs) {
  const n = pairs.length;
  if (n < 3) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function daySeries(state) {
  const dates = Object.keys(state.logs).sort();
  return dates.map((d) => {
    const l = state.logs[d];
    const r = l.ratings || {};
    const scroll = (l.incidents || []).reduce((a, i) => a + (+i.minutes || 0), 0);
    const suppTaken = state.supps.filter((s) => l.supps && l.supps[s.id] && l.supps[s.id].taken).length;
    return { date: d, sleepH: r.sleepH, work: r.work, energy: r.energy, self: r.self, scroll, suppTaken };
  });
}

function weeklySeriesFor(state, habitId) {
  const dates = Object.keys(state.logs).sort();
  return dates.map((d) => {
    let c = 0;
    const dd = new Date(d);
    for (let i = 0; i < 7; i++) {
      const iso = isoOf(dd);
      if (state.logs[iso] && state.logs[iso].habits && state.logs[iso].habits[habitId] === true) c++;
      dd.setDate(dd.getDate() - 1);
    }
    return { date: d, count: c };
  });
}

const PAIRS = [
  { a: 'sleepH', b: 'work', txt: (r) => `Im ${r > 0 ? 'więcej' : 'mniej'} śpisz, tym ${r > 0 ? 'lepiej' : 'gorzej'} oceniasz pracę` },
  { a: 'sleepH', b: 'energy', txt: (r) => `Sen ${r > 0 ? 'podnosi' : 'obniża'} Twoją energię` },
  { a: 'scroll', b: 'self', txt: (r) => `Więcej scrollowania idzie w parze z ${r > 0 ? 'lepszą' : 'gorszą'} oceną siebie` },
  { a: 'scroll', b: 'work', txt: (r) => `Więcej scrollowania = ${r > 0 ? 'lepsza' : 'gorsza'} praca tego dnia` },
  { a: 'suppTaken', b: 'energy', txt: () => `Wzięte suplementy a energia` },
];

export function confLevel(n) {
  if (n >= 21) return ['high', 'dużo danych — całkiem pewne'];
  if (n >= 10) return ['mid', 'średnio danych — ostrożnie'];
  return ['low', 'mało danych — tylko sygnał'];
}

export function correlations(state) {
  const series = daySeries(state);
  const found = [];
  PAIRS.forEach((p) => {
    const pairs = series
      .filter((s) => s[p.a] != null && s[p.b] != null)
      .map((s) => [s[p.a], s[p.b]]);
    const r = pearson(pairs);
    if (r !== null && Math.abs(r) >= 0.25) found.push({ head: p.txt(r), r, n: pairs.length });
  });
  const weeklyH = state.habits.find((h) => h.type === 'weekly');
  if (weeklyH) {
    const ws = weeklySeriesFor(state, weeklyH.id);
    const map = Object.fromEntries(series.map((s) => [s.date, s]));
    const pairs = ws.filter((w) => map[w.date] && map[w.date].work != null).map((w) => [w.count, map[w.date].work]);
    const r = pearson(pairs);
    if (r !== null && Math.abs(r) >= 0.25)
      found.push({ head: `Liczba treningów (${weeklyH.name}) w tygodniu a jakość pracy`, r, n: pairs.length });
  }
  found.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  return found;
}

export function statSummary(state) {
  const dates = Object.keys(state.logs).sort();
  let totalIncidents = 0, totalScrollMin = 0, daysLogged = 0, noteCount = 0;
  dates.forEach((d) => {
    const l = state.logs[d];
    if (Object.keys(l.habits || {}).length || (l.incidents || []).length || Object.keys(l.ratings || {}).length) daysLogged++;
    (l.incidents || []).forEach((i) => { totalIncidents++; totalScrollMin += +i.minutes || 0; });
    noteCount += Object.keys(l.notes || {}).length + (l.ratings && l.ratings.note ? 1 : 0) + (l.incidents || []).filter((i) => i.trigger).length;
  });
  const streaks = state.habits.filter((h) => h.type === 'good').map((h) => goodStreak(state, h.id, todayISO()));
  const maxStreak = streaks.length ? Math.max(...streaks) : 0;
  return { maxStreak, daysLogged, totalIncidents, scrollHours: Math.round((totalScrollMin / 60) * 10) / 10, noteCount };
}

export function hourHistogram(state) {
  const hours = new Array(24).fill(0);
  Object.keys(state.logs).forEach((d) =>
    (state.logs[d].incidents || []).forEach((i) => {
      const h = parseInt((i.time || '12:00').slice(0, 2), 10);
      hours[h] += +i.minutes || 0;
    })
  );
  return hours;
}
