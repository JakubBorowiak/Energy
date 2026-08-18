// Lokalne powiadomienia (przypomnienia). Działa w Expo Go dla notyfikacji lokalnych.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensurePermission() {
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync();
    granted = req.granted;
  }
  if (granted && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Przypomnienia',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

function parseHM(hm) {
  const [h, m] = (hm || '20:00').split(':').map((x) => parseInt(x, 10));
  return { hour: isNaN(h) ? 20 : h, minute: isNaN(m) ? 0 : m };
}

// Ustawia (lub usuwa) codzienne przypomnienie o danym identyfikatorze.
async function setDaily(id, title, body, hm, enabled) {
  // Najpierw usuń istniejące o tym id (przechowujemy mapowanie w treści)
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if (n.content && n.content.data && n.content.data.reminderId === id) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
  if (!enabled) return;
  const { hour, minute } = parseHM(hm);
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { reminderId: id } },
    trigger: { hour, minute, repeats: true },
  });
}

// reminders: { supps:{enabled,time}, evening:{enabled,time} }
export async function applyReminders(reminders) {
  const ok = await ensurePermission();
  if (!ok) return false;
  await setDaily('supps', '💊 Suplementy', 'Pora na stack — nie zapomnij zaznaczyć.', reminders.supps.time, reminders.supps.enabled);
  await setDaily('evening', '🌙 Podsumowanie dnia', 'Jak minął dzień? Oceń sen, pracę i energię.', reminders.evening.time, reminders.evening.enabled);
  return true;
}

export async function sendTestNotification() {
  const ok = await ensurePermission();
  if (!ok) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: '🔋 Energy', body: 'Powiadomienia działają!' },
    trigger: { seconds: 3 },
  });
  return true;
}
