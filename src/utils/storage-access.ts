import Constants from 'expo-constants';
import { Directory } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { PermissionsAndroid, Platform } from 'react-native';

export const DEVICE_STORAGE_ROOT = 'file:///storage/emulated/0';

export function storageAccessSupported(): boolean {
  return Platform.OS === 'android';
}

export function hasStorageAccess(): boolean {
  if (!storageAccessSupported()) return false;
  try {
    return new Directory(DEVICE_STORAGE_ROOT).list().length > 0;
  } catch {
    return false;
  }
}

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
