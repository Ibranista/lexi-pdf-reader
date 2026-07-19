/**
 * Device-wide storage access (Foxit-style "scan my whole phone").
 *
 * Android 11+ needs the "All files access" special permission
 * (MANAGE_EXTERNAL_STORAGE) — a Settings toggle, not a dialog — so the
 * request opens the system settings page for this app and resolves when
 * the user comes back. Android 10 and below use the classic
 * READ_EXTERNAL_STORAGE runtime dialog. iOS/web have no equivalent.
 */
import Constants from 'expo-constants';
import { Directory } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { PermissionsAndroid, Platform } from 'react-native';

export const DEVICE_STORAGE_ROOT = 'file:///storage/emulated/0';

export function storageAccessSupported(): boolean {
  return Platform.OS === 'android';
}

/**
 * True when we can actually read shared storage right now.
 *
 * Note: without "All files access" on Android 11+, listing the storage root
 * does NOT throw — it just returns an empty array. So a successful, non-empty
 * listing is the real signal that the permission is held (every device root
 * has standard folders like Download/DCIM). This is the JS-only stand-in for
 * the native `Environment.isExternalStorageManager()` check.
 */
export function hasStorageAccess(): boolean {
  if (!storageAccessSupported()) return false;
  try {
    return new Directory(DEVICE_STORAGE_ROOT).list().length > 0;
  } catch {
    return false;
  }
}

/**
 * Asks for device-wide storage access and resolves with the resulting state.
 * On Android 11+ this round-trips through the system settings page.
 */
export async function requestStorageAccess(): Promise<boolean> {
  if (!storageAccessSupported()) return false;
  if (hasStorageAccess()) return true;

  if ((Platform.Version as number) >= 30) {
    const pkg = Constants.expoConfig?.android?.package;
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        pkg ? { data: `package:${pkg}` } : undefined,
      );
    } catch {
      // some OEMs don't handle the per-app screen — fall back to the list
      try {
        await IntentLauncher.startActivityAsync(
          'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
        );
      } catch {
        return false;
      }
    }
  } else {
    try {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );
    } catch {
      return false;
    }
  }
  return hasStorageAccess();
}
