import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Single shared MMKV instance for on-device key/value persistence. */
export const storage = createMMKV();

/** Adapts the synchronous MMKV instance to zustand's `persist` storage contract. */
export const zustandStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};
