import { Directory, File, Paths } from "expo-file-system";
import * as Crypto from "expo-crypto";
import type { Lang } from "@/stores/app-store";
import { api } from "@/utils/axios";

export interface AiVoice {
  id: string;
  name: string;
  description: string;
  supportedLanguages: Lang[];
  samples: Partial<Record<Lang, string>>;
}
export async function fetchVoices(): Promise<AiVoice[]> {
  const { data } = await api.get<{ voices: AiVoice[] }>("/ai/voices");
  return data.voices;
}
const downloads = new Map<string, Promise<string>>();
export function cachedVoiceSample(url: string): Promise<string> {
  const pending = downloads.get(url);
  if (pending) return pending;
  const task = (async () => {
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      url,
    );
    const directory = new Directory(Paths.cache, "voice-previews");
    directory.create({ intermediates: true, idempotent: true });
    const file = new File(directory, `${key}.wav`);
    if (file.exists && file.size > 44) return file.uri;
    const temporary = new File(directory, `${key}.download`);
    try {
      await File.downloadFileAsync(url, temporary, { idempotent: true });
      if (temporary.size <= 44) throw new Error("The voice sample is empty.");
      temporary.move(file);
      return file.uri;
    } catch (error) {
      if (temporary.exists) temporary.delete();
      throw error;
    }
  })().finally(() => downloads.delete(url));
  downloads.set(url, task);
  return task;
}
