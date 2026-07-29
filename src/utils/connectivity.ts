import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

let online = true;

const reconnectHandlers = new Set<() => void>();

const readState = (state: NetInfoState) => {
  const next = state.isConnected !== false && state.isInternetReachable !== false;
  const regained = next && !online;
  online = next;
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
