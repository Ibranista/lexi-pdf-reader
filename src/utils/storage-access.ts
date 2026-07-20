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

/**
 * Standard shared-storage folders present on virtually every Android device.
 * Used to sense whether files (not just the permission-less folder skeleton)
 * are actually visible.
 */
const PROBE_SUBDIRS = [
  'Download',
  'Documents',
  'DCIM',
  'Pictures',
  'Music',
  'Movies',
];

export function storageAccessSupported(): boolean {
  return Platform.OS === 'android';
}

/**
 * True when we can actually read shared storage right now.
 *
 * The check differs by Android version because the failure modes differ:
 *
 * - Android 11+ (API 30+): the shared-storage *directory skeleton* is
 *   world-traversable even WITHOUT "All files access" — `list()` on the root
 *   returns the standard folders (Download, DCIM, …) while the FUSE layer
 *   hides every file inside them. So listing the root is a false signal.
 *   The only thing gated on the real permission is *writing* to the root, so
 *   we probe with a create-and-delete. This is the JS-only stand-in for the
 *   native `Environment.isExternalStorageManager()` check (which would need a
 *   custom native module + rebuild).
 *
 * - Android 10 and below: there is no scoped-storage file-hiding, so listing
 *   the root genuinely reflects READ_EXTERNAL_STORAGE — a non-empty listing
 *   (or any successful listing) means access is held.
 */
export function hasStorageAccess(): boolean {
  if (!storageAccessSupported()) return false;

  // Android 10 and below: no scoped-storage file-hiding, so a successful
  // (non-empty) listing of the root reflects real READ_EXTERNAL_STORAGE.
  if ((Platform.Version as number) < 30) {
    try {
      return new Directory(DEVICE_STORAGE_ROOT).list().length > 0;
    } catch {
      return false;
    }
  }

  // Android 11+: without "All files access" the OS exposes only the top-level
  // folder *names* (a skeleton) and hides every file inside them. So:

  // (a) Read signal — if any standard folder reveals a real FILE (not just a
  //     sub-folder name), the files are no longer hidden → access is held.
  //     The skeleton only ever exposes directories, never files, so this
  //     cannot false-positive.
  for (const name of PROBE_SUBDIRS) {
    try {
      const entries = new Directory(DEVICE_STORAGE_ROOT, name).list();
      if (entries.some((e) => !e.uri.endsWith('/'))) return true;
    } catch {
      // folder missing or unreadable — try the next
    }
  }

  // (b) Write signal — writing anywhere in shared storage requires the
  //     permission. Probe a standard folder (created if missing) rather than
  //     the storage root, since some OEMs block direct writes to the very
  //     top-level directory even when access is granted.
  try {
    const probe = new Directory(
      DEVICE_STORAGE_ROOT,
      'Documents',
      `.lexipdf-probe-${Date.now()}`,
    );
    probe.create({ intermediates: true });
    const ok = probe.exists;
    try {
      probe.delete();
    } catch {
      // best-effort cleanup
    }
    return ok;
  } catch {
    return false; // can't read files anywhere and can't write → not held
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
