import { router } from "expo-router";

import { SettingsPanel } from "@/components/settings/SettingsPanel";

/**
 * Settings as a pushed route. The library screen instead renders
 * `SettingsPanel` as a left drawer; this route stays for deep links and for
 * anywhere Settings needs its own entry on the stack.
 */
export default function SettingsScreen() {
  return <SettingsPanel onClose={() => router.back()} />;
}
