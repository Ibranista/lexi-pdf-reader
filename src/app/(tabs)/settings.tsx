import { router } from "expo-router";

import { SettingsPanel } from "@/components/settings/SettingsPanel";

export default function SettingsScreen() {
  return <SettingsPanel onClose={() => router.back()} />;
}
