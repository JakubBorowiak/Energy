// Eksport kopii danych do pliku i udostępnienie (share sheet).
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportJSON } from './store';

export async function shareBackup(state) {
  const json = exportJSON(state);
  const stamp = new Date().toISOString().slice(0, 10);
  const uri = FileSystem.cacheDirectory + `energy-backup-${stamp}.json`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Kopia danych Energy' });
    return { ok: true };
  }
  return { ok: false, uri };
}
