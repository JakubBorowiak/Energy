import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView, ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, StatusBar, Platform, Alert, Switch,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { C } from './src/theme';
import {
  loadState, persist, logFor, goodStreak, badCleanStreak, weeklyCount,
  correlations, confLevel, statSummary, hourHistogram, daySeries,
  todayISO, isoOf, uid, nowHM, DOPAMINE_PRESETS, TRIGGERS,
  loadSettings, saveSettings, parseImport,
} from './src/store';
import { analyzeWithAI } from './src/ai';
import { applyReminders, sendTestNotification } from './src/notify';
import { shareBackup } from './src/backup';

export default function App() {
  const [state, setState] = useState(null);
  const [settings, setSettings] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState('today');
  const [modal, setModal] = useState(null); // {title, fields, onSave} lub {custom}

  useEffect(() => { loadState().then(setState); loadSettings().then(setSettings); }, []);

  const commit = useCallback((mutator) => {
    setState((prev) => {
      const next = { ...prev, logs: { ...prev.logs }, habits: [...prev.habits], supps: [...prev.supps] };
      mutator(next);
      persist(next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((mutator) => {
    setSettings((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      mutator(next);
      saveSettings(next);
      return next;
    });
  }, []);

  if (!state || !settings) return <SafeAreaView style={s.root}><Text style={{ color: C.muted, margin: 30 }}>Ładowanie…</Text></SafeAreaView>;

  const l = logFor(state, date);
  const isToday = date === todayISO();
  const shiftDay = (n) => {
    const d = new Date(date); d.setDate(d.getDate() + n);
    const iso = isoOf(d); if (iso > todayISO()) return; setDate(iso);
  };

  const dateLabel = (() => {
    const d = new Date(date);
    const str = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    const cap = str.charAt(0).toUpperCase() + str.slice(1);
    return isToday ? 'Dziś · ' + cap : cap;
  })();

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.h1}>Energy</Text>
          <Text style={s.dateLabel}>{dateLabel}</Text>
        </View>
        <View style={s.daynav}>
          <TouchableOpacity style={s.navBtn} onPress={() => shiftDay(-1)}><Text style={s.navTxt}>‹</Text></TouchableOpacity>
          <TouchableOpacity style={[s.navBtn, { width: 'auto', paddingHorizontal: 12 }]} onPress={() => setDate(todayISO())}><Text style={[s.navTxt, { fontSize: 13 }]}>dziś</Text></TouchableOpacity>
          <TouchableOpacity style={s.navBtn} onPress={() => shiftDay(1)}><Text style={s.navTxt}>›</Text></TouchableOpacity>
        </View>
      </View>

      {tab === 'today' && <TodayView state={state} date={date} l={l} commit={commit} setModal={setModal} />}
      {tab === 'stats' && <StatsView state={state} settings={settings} goToSettings={() => setTab('settings')} />}
      {tab === 'settings' && <SettingsView state={state} setState={setState} settings={settings} updateSettings={updateSettings} setModal={setModal} />}

      {/* Tabbar */}
      <View style={s.tabbar}>
        <TabBtn icon="✅" label="Dziś" active={tab === 'today'} onPress={() => setTab('today')} />
        <TabBtn icon="📊" label="Statystyki" active={tab === 'stats'} onPress={() => setTab('stats')} />
        <TabBtn icon="⚙️" label="Ustawienia" active={tab === 'settings'} onPress={() => setTab('settings')} />
      </View>

      <FormModal modal={modal} setModal={setModal} />
    </SafeAreaView>
  );
}

/* ==================== WIDOK DZIŚ ==================== */
function TodayView({ state, date, l, commit, setModal }) {
  const noteKeyHas = (key) => !!(l.notes && l.notes[key]);
  const openNote = (key, title) =>
    setModal({
      title: '📝 Notatka · ' + title,
      fields: [{ id: 'note', label: `Na dziś (${date})`, value: l.notes[key] || '', multiline: true, placeholder: 'np. wziąłem po jedzeniu…' }],
      onSave: (v) => commit((st) => {
        const lg = logFor(st, date);
        if (v.note && v.note.trim()) lg.notes[key] = v.note.trim(); else delete lg.notes[key];
      }),
    });

  const NoteBtn = ({ k, title }) => (
    <TouchableOpacity onPress={() => openNote(k, title)} style={s.noteBtn}>
      <Text style={{ fontSize: 14, opacity: noteKeyHas(k) ? 1 : 0.5 }}>{noteKeyHas(k) ? '📝' : '✎'}</Text>
    </TouchableOpacity>
  );

  const toggleHabit = (id) => commit((st) => { const lg = logFor(st, date); lg.habits[id] = !(lg.habits[id] === true); });

  const addHabit = (type) => setModal({
    title: type === 'good' ? 'Nowy nawyk' : type === 'bad' ? 'Nawyk do rzucenia' : 'Nawyk tygodniowy',
    fields: [
      { id: 'name', label: 'Nazwa', placeholder: 'np. Medytacja' },
      ...(type === 'weekly' ? [{ id: 'target', label: 'Cel na tydzień (ile razy)', value: '3', numeric: true }] : []),
    ],
    onSave: (v) => { if (!v.name) return; commit((st) => { const h = { id: uid(), type, name: v.name }; if (type === 'weekly') h.target = +v.target || 3; st.habits.push(h); }); },
  });
  const editHabit = (h) => setModal({
    title: 'Edytuj: ' + h.name,
    fields: [
      { id: 'name', label: 'Nazwa', value: h.name },
      ...(h.type === 'weekly' ? [{ id: 'target', label: 'Cel/tydzień', value: String(h.target), numeric: true }] : []),
    ],
    danger: 'Usuń nawyk',
    onDelete: () => commit((st) => { st.habits = st.habits.filter((x) => x.id !== h.id); }),
    onSave: (v) => commit((st) => { const hh = st.habits.find((x) => x.id === h.id); if (hh) { hh.name = v.name || hh.name; if (hh.type === 'weekly') hh.target = +v.target || hh.target; } }),
  });

  const goods = state.habits.filter((h) => h.type === 'good');
  const bads = state.habits.filter((h) => h.type === 'bad');
  const weeklies = state.habits.filter((h) => h.type === 'weekly');

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
      {/* GOOD */}
      <SectionTitle title="Nawyki dzienne" onAdd={() => addHabit('good')} />
      <Card>
        {goods.length ? goods.map((h) => {
          const done = l.habits[h.id] === true;
          const st = goodStreak(state, h.id, date);
          return <HabitRow key={h.id} name={h.name} sub={st ? `🔥 ${st}` : ''} done={done}
            onPress={() => toggleHabit(h.id)} onMenu={() => editHabit(h)} note={<NoteBtn k={h.id} title={h.name} />} />;
        }) : <Empty />}
      </Card>

      {/* BAD */}
      <SectionTitle title="Do rzucenia" onAdd={() => addHabit('bad')} />
      <Card>
        {bads.length ? bads.map((h) => {
          const slip = l.habits[h.id] === true;
          const clean = badCleanStreak(state, h.id, date);
          return <HabitRow key={h.id} name={h.name} sub={slip ? 'uległem' : `✨ ${clean} dni czysto`} bad slip={slip}
            onPress={() => toggleHabit(h.id)} onMenu={() => editHabit(h)} note={<NoteBtn k={h.id} title={h.name} />} />;
        }) : <Empty />}
      </Card>

      {/* WEEKLY */}
      <SectionTitle title="Tygodniowe" onAdd={() => addHabit('weekly')} />
      <Card>
        {weeklies.length ? weeklies.map((h) => {
          const done = l.habits[h.id] === true;
          const cnt = weeklyCount(state, h.id, date);
          return <HabitRow key={h.id} name={h.name} sub={`${cnt}/${h.target} w tyg.`} done={done}
            progress={Math.min(1, cnt / h.target)}
            onPress={() => toggleHabit(h.id)} onMenu={() => editHabit(h)} note={<NoteBtn k={h.id} title={h.name} />} />;
        }) : <Empty />}
      </Card>

      {/* SUPPS */}
      <SectionTitle title="Suplementy" onAdd={() => setModal({
        title: 'Nowy suplement w stacku',
        fields: [{ id: 'name', label: 'Nazwa', placeholder: 'np. Kreatyna' }, { id: 'time', label: 'Domyślna godzina', value: '08:00', placeholder: 'HH:MM' }],
        onSave: (v) => { if (!v.name) return; commit((st) => st.supps.push({ id: uid(), name: v.name, defaultTime: v.time || '08:00' })); },
      })} />
      <SupplementStack state={state} date={date} l={l} commit={commit} setModal={setModal} NoteBtn={NoteBtn} />

      {/* RATINGS */}
      <SectionTitle title="Ocena dnia" />
      <Card><Ratings date={date} l={l} commit={commit} /></Card>

      {/* INCIDENTS */}
      <SectionTitle title="Incydenty (scroll / dopamina)" onAdd={() => setModal({
        title: 'Co Cię wciągnęło?',
        chips: { presets: DOPAMINE_PRESETS, triggers: TRIGGERS },
        fields: [
          { id: 'name', label: 'Aplikacja / czynność', placeholder: 'np. Instagram' },
          { id: 'minutes', label: 'Ile minut', value: '20', numeric: true },
          { id: 'time', label: 'Godzina', value: nowHM(), placeholder: 'HH:MM' },
        ],
        onSave: (v) => { if (!v.name) return; commit((st) => logFor(st, date).incidents.push({ id: uid(), name: v.name, minutes: +v.minutes || 0, time: v.time, trigger: v.trigger || '' })); },
      })} />
      <Card>
        {l.incidents.length ? l.incidents.map((inc, i) => (
          <View key={inc.id} style={s.incident}>
            <Text style={{ fontSize: 20 }}>📱</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.incTitle}>{inc.name} · {inc.minutes} min</Text>
              <Text style={s.incSub}>{inc.time}{inc.trigger ? ' · ' + inc.trigger : ''}</Text>
            </View>
            <TouchableOpacity onPress={() => commit((st) => { logFor(st, date).incidents.splice(i, 1); })}><Text style={{ color: C.bad, fontSize: 16, padding: 4 }}>✕</Text></TouchableOpacity>
          </View>
        )) : <Text style={s.empty}>Nic dziś. Dodaj ＋ gdy się złapiesz na scrollowaniu.</Text>}
      </Card>
    </ScrollView>
  );
}

/* ==================== STACK SUPLEMENTÓW ==================== */
function SupplementStack({ state, date, l, commit, setModal, NoteBtn }) {
  const allTaken = state.supps.length > 0 && state.supps.every((sp) => l.supps[sp.id] && l.supps[sp.id].taken);
  const takenCount = state.supps.filter((sp) => l.supps[sp.id] && l.supps[sp.id].taken).length + (l.extras ? l.extras.length : 0);

  const toggleStack = () => commit((st) => {
    const lg = logFor(st, date);
    const anyMissing = st.supps.some((sp) => !(lg.supps[sp.id] && lg.supps[sp.id].taken));
    st.supps.forEach((sp) => { lg.supps[sp.id] = { taken: anyMissing, time: (lg.supps[sp.id] && lg.supps[sp.id].time) || sp.defaultTime }; });
  });
  const toggleOne = (sp) => commit((st) => {
    const lg = logFor(st, date); const cur = lg.supps[sp.id] && lg.supps[sp.id].taken;
    lg.supps[sp.id] = { taken: !cur, time: (lg.supps[sp.id] && lg.supps[sp.id].time) || sp.defaultTime };
  });
  const setTime = (sp, t) => commit((st) => {
    const lg = logFor(st, date); lg.supps[sp.id] = { taken: (lg.supps[sp.id] && lg.supps[sp.id].taken) || false, time: t };
  });
  const editSupp = (sp) => setModal({
    title: 'Edytuj: ' + sp.name,
    fields: [{ id: 'name', label: 'Nazwa', value: sp.name }, { id: 'time', label: 'Domyślna godzina', value: sp.defaultTime, placeholder: 'HH:MM' }],
    danger: 'Usuń ze stacku',
    onDelete: () => commit((st) => { st.supps = st.supps.filter((x) => x.id !== sp.id); }),
    onSave: (v) => commit((st) => { const ss = st.supps.find((x) => x.id === sp.id); if (ss) { ss.name = v.name || ss.name; ss.defaultTime = v.time || ss.defaultTime; } }),
  });
  const addExtra = () => setModal({
    title: 'Dodatkowy suplement (dziś)',
    fields: [{ id: 'name', label: 'Nazwa', placeholder: 'np. Cynk' }, { id: 'time', label: 'Godzina', value: nowHM(), placeholder: 'HH:MM' }],
    onSave: (v) => { if (!v.name) return; commit((st) => logFor(st, date).extras.push({ name: v.name, time: v.time })); },
  });

  return (
    <Card>
      <View style={s.suppHead}>
        <TouchableOpacity onPress={toggleStack} style={[s.check, allTaken && s.checkGood]}><Text style={s.checkMark}>{allTaken ? '✓' : ''}</Text></TouchableOpacity>
        <TouchableOpacity style={{ flex: 1, paddingVertical: 4 }} onPress={toggleStack}>
          <Text style={s.habitName}>Stack suplementów</Text>
          <Text style={s.habitSub}>{takenCount > 0 ? takenCount + ' wzięte dziś' : 'Kliknij, by wziąć cały stack'}</Text>
        </TouchableOpacity>
        <NoteBtn k="stack" title="Stack suplementów" />
      </View>
      <View style={s.suppList}>
        {state.supps.map((sp) => {
          const st = l.supps[sp.id] || { taken: false, time: sp.defaultTime };
          return (
            <View key={sp.id} style={s.suppRow}>
              <TouchableOpacity onPress={() => toggleOne(sp)} style={[s.suppCheck, st.taken && s.checkGood]}><Text style={s.checkMark}>{st.taken ? '✓' : ''}</Text></TouchableOpacity>
              <Text style={[s.suppName, !st.taken && s.suppNameOff]}>{sp.name}</Text>
              <TextInput style={s.suppTime} value={st.time || sp.defaultTime} placeholder="HH:MM" placeholderTextColor={C.muted}
                onChangeText={(t) => setTime(sp, t)} maxLength={5} />
              <NoteBtn k={'supp:' + sp.id} title={sp.name} />
              <TouchableOpacity onPress={() => editSupp(sp)}><Text style={{ color: C.muted, fontSize: 15, paddingHorizontal: 4 }}>⋯</Text></TouchableOpacity>
            </View>
          );
        })}
        {(l.extras || []).map((ex, i) => (
          <View key={'ex' + i} style={s.suppRow}>
            <View style={[s.suppCheck, s.checkGood]}><Text style={s.checkMark}>✓</Text></View>
            <Text style={s.suppName}>{ex.name} <Text style={{ color: C.purple, fontSize: 11 }}>dodatkowy</Text></Text>
            <Text style={s.suppTime}>{ex.time}</Text>
            <TouchableOpacity onPress={() => commit((st) => { logFor(st, date).extras.splice(i, 1); })}><Text style={{ color: C.bad, padding: 4 }}>✕</Text></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={addExtra}><Text style={s.suppAdd}>＋ dodaj suplement tylko na dziś</Text></TouchableOpacity>
      </View>
    </Card>
  );
}

/* ==================== OCENA DNIA ==================== */
const RATING_DEFS = [
  { key: 'sleepH', label: 'Sen (godziny)', type: 'num', def: 7 },
  { key: 'sleepTime', label: 'Pójście spać', type: 'time' },
  { key: 'work', label: 'Jakość pracy', type: 'range', def: 5 },
  { key: 'energy', label: 'Energia / samopoczucie', type: 'range', def: 5 },
  { key: 'self', label: 'Ogólna ocena siebie', type: 'range', def: 5 },
];
function Ratings({ date, l, commit }) {
  const setR = (key, v) => commit((st) => { logFor(st, date).ratings[key] = v; });
  return (
    <View>
      {RATING_DEFS.map((r) => {
        if (r.type === 'range') {
          const v = l.ratings[r.key] != null ? l.ratings[r.key] : r.def;
          return (
            <View key={r.key} style={s.rating}>
              <View style={s.ratingLabel}><Text style={s.ratingTxt}>{r.label}</Text><Text style={s.ratingVal}>{v}/10</Text></View>
              <Slider minimumValue={1} maximumValue={10} step={1} value={v}
                minimumTrackTintColor={C.accent} maximumTrackTintColor={C.surface2} thumbTintColor={C.accent}
                onValueChange={(nv) => setR(r.key, Math.round(nv))} />
            </View>
          );
        }
        if (r.type === 'num') {
          return (
            <View key={r.key} style={s.rating}>
              <View style={s.ratingLabel}><Text style={s.ratingTxt}>{r.label}</Text></View>
              <TextInput style={s.numInput} keyboardType="numeric" placeholder={String(r.def)} placeholderTextColor={C.muted}
                value={l.ratings[r.key] != null ? String(l.ratings[r.key]) : ''}
                onChangeText={(t) => setR(r.key, t === '' ? null : parseFloat(t.replace(',', '.')))} />
            </View>
          );
        }
        return (
          <View key={r.key} style={s.rating}>
            <View style={s.ratingLabel}><Text style={s.ratingTxt}>{r.label}</Text></View>
            <TextInput style={s.numInput} placeholder="HH:MM" placeholderTextColor={C.muted} maxLength={5}
              value={l.ratings[r.key] || ''} onChangeText={(t) => setR(r.key, t)} />
          </View>
        );
      })}
      <View style={s.rating}>
        <View style={s.ratingLabel}><Text style={s.ratingTxt}>Notatka dnia</Text></View>
        <TextInput style={s.fieldNote} multiline placeholder="Co się dziś działo? Jak się czułeś?" placeholderTextColor={C.muted}
          value={l.ratings.note || ''} onChangeText={(t) => setR('note', t)} />
      </View>
    </View>
  );
}

/* ==================== STATYSTYKI ==================== */
function StatsView({ state, settings, goToSettings }) {
  const sum = statSummary(state);
  const corr = correlations(state);
  const hours = hourHistogram(state);
  const maxH = Math.max(1, ...hours);
  const withData = daySeries(state).filter((d) => d.work != null || d.energy != null).length;
  const [aiState, setAiState] = useState(null); // null | 'loading' | {text} | {error}

  const runAI = async () => {
    if (!settings.apiKey) { setAiState({ error: 'Brak klucza API. Wejdź w Ustawienia i wklej klucz Anthropic.' }); return; }
    setAiState('loading');
    const res = await analyzeWithAI(state, settings.apiKey);
    setAiState(res.error ? { error: res.error } : { text: res.text });
  };

  const cal = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = isoOf(d); const lg = state.logs[iso];
    const done = lg ? Object.values(lg.habits || {}).filter((v) => v === true).length : 0;
    cal.push({ iso, done });
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 14 }}>
      <View style={{ height: 8 }} />
      <View style={s.statGrid}>
        <StatBox big={sum.maxStreak + '🔥'} lbl="najlepszy streak" />
        <StatBox big={sum.daysLogged} lbl="dni z danymi" />
        <StatBox big={sum.totalIncidents} lbl="incydentów łącznie" />
        <StatBox big={sum.scrollHours + 'h'} lbl="czas na scrollu" />
      </View>

      <SectionTitle title="Aktywność (30 dni)" bare />
      <View style={s.statBox}>
        <View style={s.calGrid}>
          {cal.map((c) => (
            <View key={c.iso} style={[s.calCell, c.done > 0 && { backgroundColor: `rgba(62,207,142,${0.25 + Math.min(1, c.done / 3) * 0.6})` }]} />
          ))}
        </View>
      </View>

      <SectionTitle title="Scrollowanie wg godziny" bare />
      <View style={s.statBox}>
        <View style={s.bars}>
          {hours.map((v, i) => <View key={i} style={[s.bar, { height: `${(v / maxH) * 100}%` }]} />)}
        </View>
        <View style={s.hourLabels}><Text style={s.hourLbl}>0</Text><Text style={s.hourLbl}>6</Text><Text style={s.hourLbl}>12</Text><Text style={s.hourLbl}>18</Text><Text style={s.hourLbl}>23</Text></View>
      </View>

      <SectionTitle title="Radar korelacji (automat)" bare />
      {corr.length ? corr.map((f, i) => {
        const [cls, label] = confLevel(f.n);
        const color = cls === 'high' ? C.good : cls === 'mid' ? C.warn : C.bad;
        return (
          <View key={i} style={s.corr}>
            <Text style={s.corrHead}>{f.r > 0 ? '↗' : '↘'} <Text style={{ fontWeight: '700' }}>{f.head}.</Text></Text>
            <Text style={[s.corrConf, { color, backgroundColor: color + '26' }]}>{label} · {f.n} dni · siła {Math.abs(f.r).toFixed(2)}</Text>
          </View>
        );
      }) : <Text style={s.empty}>Za mało danych, żeby coś wyłapać. Klikaj codziennie kilka dni — radar sam się odezwie.</Text>}

      <TouchableOpacity style={[s.aiBtn, aiState === 'loading' && { opacity: 0.6 }]} disabled={aiState === 'loading'} onPress={runAI}>
        <Text style={s.aiBtnTxt}>{aiState === 'loading' ? '⏳ Analizuję…' : '✨ Przeanalizuj z AI (głębiej)'}</Text>
      </TouchableOpacity>
      {aiState && aiState !== 'loading' && (
        <View style={[s.corr, { borderColor: aiState.error ? C.bad : C.purple }]}>
          <Text style={s.corrHead}>✨ <Text style={{ fontWeight: '700' }}>Analiza AI</Text></Text>
          {aiState.error ? (
            <>
              <Text style={{ color: C.bad, fontSize: 13, marginTop: 8, lineHeight: 19 }}>{aiState.error}</Text>
              {!settings.apiKey && <TouchableOpacity onPress={goToSettings}><Text style={{ color: C.accent, marginTop: 8, fontSize: 13 }}>→ Przejdź do Ustawień</Text></TouchableOpacity>}
            </>
          ) : (
            <Text style={{ color: C.text, fontSize: 13, marginTop: 8, lineHeight: 20 }}>{aiState.text}</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/* ==================== USTAWIENIA ==================== */
function SettingsView({ state, setState, settings, updateSettings, setModal }) {
  const [busy, setBusy] = useState(false);

  const saveReminders = async (next) => {
    updateSettings((st) => { st.reminders = next.reminders; });
    const ok = await applyReminders(next.reminders);
    if (!ok) Alert.alert('Powiadomienia', 'Nie udało się włączyć — sprawdź uprawnienia w ustawieniach telefonu.');
  };
  const toggleReminder = (which, enabled) => {
    const next = JSON.parse(JSON.stringify(settings));
    next.reminders[which].enabled = enabled;
    saveReminders(next);
  };
  const setReminderTime = (which, time) => {
    const next = JSON.parse(JSON.stringify(settings));
    next.reminders[which].time = time;
    saveReminders(next);
  };

  const doExport = async () => {
    setBusy(true);
    try {
      const r = await shareBackup(state);
      if (!r.ok) Alert.alert('Kopia zapisana', 'Plik: ' + r.uri);
    } catch (e) { Alert.alert('Błąd eksportu', e.message || String(e)); }
    setBusy(false);
  };

  const doImport = () => setModal({
    title: 'Import kopii danych',
    fields: [{ id: 'json', label: 'Wklej zawartość pliku kopii (JSON)', multiline: true, placeholder: '{ "version": 1, ... }' }],
    onSave: (v) => {
      try {
        const data = parseImport(v.json || '');
        Alert.alert('Zastąpić dane?', 'Import nadpisze obecne dane w aplikacji.', [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Zastąp', style: 'destructive', onPress: () => { setState(data); persist(data); Alert.alert('Gotowe', 'Dane wczytane.'); } },
        ]);
      } catch (e) { Alert.alert('Nieprawidłowy plik', e.message || String(e)); }
    },
  });

  const testNotif = async () => {
    const ok = await sendTestNotification();
    if (!ok) Alert.alert('Powiadomienia', 'Brak zgody na powiadomienia.');
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 14 }}>
      <View style={{ height: 8 }} />

      <SectionTitle title="Analiza AI (Claude)" bare />
      <View style={s.statBox}>
        <Text style={s.setLabel}>Klucz API Anthropic</Text>
        <TextInput style={s.numInput} placeholder="sk-ant-..." placeholderTextColor={C.muted} autoCapitalize="none"
          secureTextEntry value={settings.apiKey} onChangeText={(t) => updateSettings((st) => { st.apiKey = t.trim(); })} />
        <Text style={s.setHint}>Klucz trzymany tylko na Twoim telefonie. Model: claude-opus-5. Bez klucza przycisk „Przeanalizuj z AI" nie zadziała.</Text>
      </View>

      <SectionTitle title="Przypomnienia" bare />
      <View style={s.statBox}>
        <ReminderRow label="💊 Suplementy" r={settings.reminders.supps}
          onToggle={(v) => toggleReminder('supps', v)} onTime={(t) => setReminderTime('supps', t)} />
        <View style={s.sep} />
        <ReminderRow label="🌙 Podsumowanie dnia" r={settings.reminders.evening}
          onToggle={(v) => toggleReminder('evening', v)} onTime={(t) => setReminderTime('evening', t)} />
        <TouchableOpacity onPress={testNotif}><Text style={{ color: C.accent, fontSize: 13, marginTop: 12 }}>Wyślij testowe powiadomienie</Text></TouchableOpacity>
      </View>

      <SectionTitle title="Kopia danych" bare />
      <View style={s.statBox}>
        <TouchableOpacity style={[s.btn, s.btnPrimary, { marginBottom: 10 }]} disabled={busy} onPress={doExport}>
          <Text style={{ color: '#08101f', fontWeight: '700' }}>{busy ? 'Eksportuję…' : '⬆ Eksportuj / udostępnij kopię'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={doImport}>
          <Text style={{ color: C.text, fontWeight: '600' }}>⬇ Importuj z kopii (wklej JSON)</Text>
        </TouchableOpacity>
        <Text style={s.setHint}>Eksport otwiera systemowe „Udostępnij" — zapisz plik w chmurze albo wyślij sobie.</Text>
      </View>
    </ScrollView>
  );
}
function ReminderRow({ label, r, onToggle, onTime }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ color: C.text, fontSize: 15, flex: 1 }}>{label}</Text>
      <TextInput style={[s.suppTime, { marginRight: 10 }]} value={r.time} maxLength={5} placeholder="HH:MM"
        placeholderTextColor={C.muted} onChangeText={onTime} />
      <Switch value={r.enabled} onValueChange={onToggle} trackColor={{ true: C.accent, false: C.surface2 }} thumbColor="#fff" />
    </View>
  );
}

/* ==================== KOMPONENTY WSPÓLNE ==================== */
function TabBtn({ icon, label, active, onPress }) {
  return (
    <TouchableOpacity style={s.tab} onPress={onPress}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[s.tabLbl, active && { color: C.accent }]}>{label}</Text>
    </TouchableOpacity>
  );
}
function SectionTitle({ title, onAdd, bare }) {
  return (
    <View style={[s.sectionTitle, bare && { marginHorizontal: 4 }]}>
      <Text style={s.sectionTxt}>{title}</Text>
      {onAdd && <TouchableOpacity onPress={onAdd}><Text style={s.addBtn}>＋</Text></TouchableOpacity>}
    </View>
  );
}
function Card({ children }) { return <View style={s.card}>{children}</View>; }
function Empty() { return <Text style={s.empty}>Brak — dodaj ＋</Text>; }
function StatBox({ big, lbl }) { return <View style={s.statBoxItem}><Text style={s.statBig}>{big}</Text><Text style={s.statLbl}>{lbl}</Text></View>; }

function HabitRow({ name, sub, done, bad, slip, progress, onPress, onMenu, note }) {
  const filled = done || slip;
  const checkStyle = [s.check, done && s.checkGood, bad && !slip && { borderColor: C.bad }, bad && slip && s.checkBad];
  return (
    <View style={s.habit}>
      <TouchableOpacity onPress={onPress} style={{ flexDirection: 'row', flex: 1, alignItems: 'center' }}>
        <View style={checkStyle}><Text style={s.checkMark}>{filled ? '✓' : ''}</Text></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.habitName}>{name}</Text>
          {!!sub && <Text style={[s.habitSub, bad && !slip && { color: C.good }]}>{sub}</Text>}
          {progress != null && <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>}
        </View>
      </TouchableOpacity>
      {note}
      <TouchableOpacity onPress={onMenu}><Text style={{ color: C.muted, fontSize: 18, padding: 4 }}>⋯</Text></TouchableOpacity>
    </View>
  );
}

/* ==================== MODAL FORMULARZA ==================== */
function FormModal({ modal, setModal }) {
  const [vals, setVals] = useState({});
  useEffect(() => {
    if (modal) {
      const init = {};
      (modal.fields || []).forEach((f) => { init[f.id] = f.value || ''; });
      setVals(init);
    }
  }, [modal]);
  if (!modal) return null;
  const set = (id, v) => setVals((p) => ({ ...p, [id]: v }));
  const close = () => setModal(null);
  const save = () => { modal.onSave && modal.onSave(vals); close(); };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={close}>
      <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={close}>
        <TouchableOpacity activeOpacity={1} style={s.modal} onPress={() => {}}>
          <Text style={s.modalTitle}>{modal.title}</Text>
          {(modal.fields || []).map((f) => (
            <View key={f.id}>
              <Text style={s.modalLabel}>{f.label}</Text>
              <TextInput
                style={[s.modalInput, f.multiline && { height: 90, textAlignVertical: 'top' }]}
                value={vals[f.id]} onChangeText={(t) => set(f.id, t)}
                placeholder={f.placeholder || ''} placeholderTextColor={C.muted}
                multiline={f.multiline} keyboardType={f.numeric ? 'numeric' : 'default'}
              />
            </View>
          ))}
          {modal.chips && (
            <>
              <View style={s.chipWrap}>
                {modal.chips.presets.map((p) => (
                  <TouchableOpacity key={p} style={s.chip} onPress={() => set('name', p)}><Text style={s.chipTxt}>{p}</Text></TouchableOpacity>
                ))}
              </View>
              <Text style={s.modalLabel}>Co Cię pchnęło? (opcjonalnie)</Text>
              <View style={s.chipWrap}>
                {modal.chips.triggers.map((t) => (
                  <TouchableOpacity key={t} style={[s.chip, vals.trigger === t && s.chipOn]} onPress={() => set('trigger', t)}>
                    <Text style={[s.chipTxt, vals.trigger === t && { color: '#08101f' }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {modal.danger && (
            <TouchableOpacity onPress={() => { modal.onDelete && modal.onDelete(); close(); }}>
              <Text style={{ color: C.bad, fontSize: 14, marginTop: 14 }}>🗑 {modal.danger}</Text>
            </TouchableOpacity>
          )}
          <View style={s.btns}>
            <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={close}><Text style={{ color: C.text, fontWeight: '600' }}>Anuluj</Text></TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.btnPrimary]} onPress={save}><Text style={{ color: '#08101f', fontWeight: '700' }}>Zapisz</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

/* ==================== STYLE ==================== */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'android' ? 28 : 0 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  h1: { color: C.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  dateLabel: { color: C.muted, fontSize: 13, marginTop: 2 },
  daynav: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  navBtn: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navTxt: { color: C.text, fontSize: 18 },

  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 18, marginTop: 16, marginBottom: 8 },
  sectionTxt: { color: C.muted, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '600' },
  addBtn: { color: C.accent, fontSize: 22 },
  card: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 16, marginHorizontal: 14, padding: 4 },
  empty: { color: C.muted, fontSize: 13, textAlign: 'center', padding: 20 },

  habit: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  check: { width: 28, height: 28, borderRadius: 9, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  checkGood: { backgroundColor: C.good, borderColor: C.good },
  checkBad: { backgroundColor: C.bad, borderColor: C.bad },
  checkMark: { color: '#fff', fontSize: 15, fontWeight: '700' },
  habitName: { color: C.text, fontSize: 15, fontWeight: '600' },
  habitSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  noteBtn: { padding: 6 },
  progressTrack: { height: 6, backgroundColor: C.surface2, borderRadius: 4, marginTop: 7, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.accent, borderRadius: 4 },

  suppHead: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  suppList: { borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 8, paddingVertical: 4 },
  suppRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 4, gap: 8 },
  suppCheck: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  suppName: { flex: 1, color: C.text, fontSize: 14 },
  suppNameOff: { color: C.muted, textDecorationLine: 'line-through' },
  suppTime: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, color: C.text, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, fontSize: 12, minWidth: 58, textAlign: 'center' },
  suppAdd: { color: C.accent, fontSize: 13, padding: 8 },

  rating: { padding: 12 },
  ratingLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  ratingTxt: { color: C.text, fontSize: 14 },
  ratingVal: { color: C.accent, fontSize: 14, fontWeight: '700' },
  numInput: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, color: C.text, borderRadius: 8, padding: 10, fontSize: 15, alignSelf: 'flex-start', minWidth: 90 },
  fieldNote: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, color: C.text, borderRadius: 10, padding: 10, fontSize: 14, minHeight: 60, textAlignVertical: 'top' },

  incident: { flexDirection: 'row', alignItems: 'center', padding: 11 },
  incTitle: { color: C.text, fontSize: 14, fontWeight: '600' },
  incSub: { color: C.muted, fontSize: 12, marginTop: 2 },

  tabbar: { flexDirection: 'row', backgroundColor: C.surface, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, paddingBottom: 20 },
  tab: { flex: 1, alignItems: 'center' },
  tabLbl: { color: C.muted, fontSize: 11, marginTop: 2 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBoxItem: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, width: '47.5%' },
  statBig: { color: C.text, fontSize: 26, fontWeight: '800' },
  statLbl: { color: C.muted, fontSize: 12, marginTop: 2 },
  statBox: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14 },
  setLabel: { color: C.muted, fontSize: 12, marginBottom: 6 },
  setHint: { color: C.muted, fontSize: 11, marginTop: 8, lineHeight: 16 },
  sep: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  calCell: { width: '12%', aspectRatio: 1, borderRadius: 6, backgroundColor: C.surface2 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 3 },
  bar: { flex: 1, backgroundColor: C.accent, borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2, opacity: 0.85 },
  hourLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  hourLbl: { color: C.muted, fontSize: 9 },

  corr: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, marginBottom: 10 },
  corrHead: { color: C.text, fontSize: 14, lineHeight: 20 },
  corrConf: { fontSize: 11, fontWeight: '700', marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
  aiBtn: { padding: 14, borderRadius: 14, backgroundColor: C.purple, alignItems: 'center', marginVertical: 6 },
  aiBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: C.border, padding: 20, paddingBottom: 34 },
  modalTitle: { color: C.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  modalLabel: { color: C.muted, fontSize: 12, marginTop: 10, marginBottom: 4 },
  modalInput: { backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border, color: C.text, borderRadius: 10, padding: 11, fontSize: 15 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface2 },
  chipOn: { backgroundColor: C.accent, borderColor: C.accent },
  chipTxt: { color: C.muted, fontSize: 12 },
  btns: { flexDirection: 'row', gap: 10, marginTop: 18 },
  btn: { flex: 1, padding: 13, borderRadius: 12, alignItems: 'center' },
  btnGhost: { backgroundColor: C.surface2 },
  btnPrimary: { backgroundColor: C.accent },
});
