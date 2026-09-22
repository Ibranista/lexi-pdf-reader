import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useSyncExternalStore } from "react";

let online = true;

const reconnectHandlers = new Set<() => void>();
const changeHandlers = new Set<() => void>();

const readState = (state: NetInfoState) => {
  const next = state.isConnected !== false && state.isInternetReachable !== false;
  const regained = next && !online;
  const changed = next !== online;
  online = next;
  if (changed) changeHandlers.forEach((handler) => handler());
  if (regained) reconnectHandlers.forEach((handler) => handler());
};

NetInfo.addEventListener(readState);
NetInfo.fetch().then(readState).catch(() => {});

export function isOnline(): boolean {
  return online;
}

export function onReconnect(handler: () => void): () => void {
  reconnectHandlers.add(handler);
  return () => {
    reconnectHandlers.delete(handler);
  };
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      changeHandlers.add(onStoreChange);
      return () => changeHandlers.delete(onStoreChange);
    },
    () => online,
  );
}
