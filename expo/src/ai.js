// Analiza danych przez Claude API (Messages API, bezpośredni fetch z RN).
import { daySeries } from './store';

const MODEL = 'claude-opus-5';

// Buduje zwięzły, czytelny dla modelu opis danych użytkownika (dni + notatki).
function buildDataDigest(state) {
  const series = daySeries(state);
  const dates = Object.keys(state.logs).sort();
  const lines = [];
  dates.forEach((d) => {
    const l = state.logs[d];
    const r = l.ratings || {};
    const doneHabits = Object.keys(l.habits || {})
      .filter((id) => l.habits[id] === true)
      .map((id) => (state.habits.find((h) => h.id === id) || {}).name)
      .filter(Boolean);
    const scroll = (l.incidents || []).reduce((a, i) => a + (+i.minutes || 0), 0);
    const supps = state.supps.filter((s) => l.supps && l.supps[s.id] && l.supps[s.id].taken).map((s) => s.name);
    const notes = [];
    Object.keys(l.notes || {}).forEach((k) => notes.push(`${k}: ${l.notes[k]}`));
    if (r.note) notes.push(`dzień: ${r.note}`);
    (l.incidents || []).forEach((i) => { if (i.trigger) notes.push(`${i.name}(${i.trigger})`); });

    const parts = [`[${d}]`];
    if (r.sleepH != null) parts.push(`sen=${r.sleepH}h`);
    if (r.sleepTime) parts.push(`spanie=${r.sleepTime}`);
    if (r.work != null) parts.push(`praca=${r.work}/10`);
    if (r.energy != null) parts.push(`energia=${r.energy}/10`);
    if (r.self != null) parts.push(`ja=${r.self}/10`);
    if (scroll) parts.push(`scroll=${scroll}min`);
    if (doneHabits.length) parts.push(`nawyki:{${doneHabits.join(',')}}`);
    if (supps.length) parts.push(`supl:{${supps.join(',')}}`);
    if (notes.length) parts.push(`notatki:{${notes.join(' | ')}}`);
    lines.push(parts.join(' '));
  });
  return { digest: lines.join('\n'), dayCount: series.filter((s) => s.work != null || s.energy != null).length };
}

const SYSTEM_PROMPT = `Jesteś analitykiem danych osobistych w aplikacji do śledzenia nawyków.
Dostajesz dzienne dane użytkownika: sen, oceny (praca/energia/ocena siebie 1-10), czas scrollowania,
zrobione nawyki, wzięte suplementy i notatki tekstowe.

Twoje zadanie: znaleźć realne, przydatne wzorce i zależności. Szukaj:
- korelacji między parami (np. sen a jakość pracy),
- kombinacji (np. mało snu + dużo scrolla wieczorem = gorsza praca),
- efektów opóźnionych (dzień po treningu),
- wzorców z notatek tekstowych.

ŻELAZNE ZASADY:
1. NIGDY nie wróż z fusów. Korelacja to hipoteza, nie prawda.
2. Przy KAŻDYM wniosku podaj, na ilu dniach danych się opiera i jak bardzo jesteś pewny
   (mało/średnio/dużo danych). Mało danych (<7 dni) = wyraźnie zaznacz "to tylko sygnał".
3. Pisz po polsku, po ludzku, jak trener — krótko i konkretnie.
4. Nie wymyślaj danych, których nie ma. Jeśli danych jest za mało na cokolwiek — powiedz to wprost.
5. Zakończ 1-2 konkretnymi rzeczami do przetestowania.

Format: 3-6 krótkich punktów, każdy z etykietą pewności. Bez lania wody.`;

export async function analyzeWithAI(state, apiKey) {
  const { digest, dayCount } = buildDataDigest(state);
  if (!digest.trim()) return { error: 'Brak danych do analizy. Poklikaj kilka dni najpierw.' };

  const userMsg = `Oto moje dane (${dayCount} dni z ocenami):\n\n${digest}\n\nZnajdź wzorce i zależności. Pamiętaj o etykietach pewności.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      const msg = (data && data.error && data.error.message) || `Błąd API (${res.status})`;
      return { error: msg };
    }
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { text: text || 'Model nie zwrócił treści.' };
  } catch (e) {
    return { error: 'Nie udało się połączyć z API. Sprawdź internet i klucz. ' + (e.message || '') };
  }
}
