/**
 * Best-known network reachability, readable synchronously.
 *
 * The reader needs this at first render to pick a default view: Reflow fetches
 * its pdf.js engine from a CDN, so with no internet it can only error — Page
 * view (native, offline) is the right default then. NetInfo is event-based and
 * async, so we cache the latest result here and expose a synchronous getter.
 * Optimistic until the first result arrives (assume online), because the common
 * case is online and a wrong guess is corrected within a frame or two.
 */
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

let online = true;

const reconnectHandlers = new Set<() => void>();

const readState = (state: NetInfoState) => {
  // isInternetReachable is null while NetInfo is still probing — treat unknown
  // as online; only an explicit false (no network, or network without internet)
  // counts as offline.
  const next = state.isConnected !== false && state.isInternetReachable !== false;
  const regained = next && !online;
  online = next;
  // Fired on the offline → online edge only, so a handler can retry the writes
  // that failed while there was no network without polling for the chance.
  if (regained) reconnectHandlers.forEach((handler) => handler());
};

// Subscribe once, at module load, so `isOnline()` is warm by the time a reader
// screen mounts.
NetInfo.addEventListener(readState);
NetInfo.fetch().then(readState).catch(() => {});

/** Latest known connectivity, synchronous. Optimistically true before the first
 *  NetInfo result. */
export function isOnline(): boolean {
  return online;
}

/**
 * Run `handler` each time the device comes back online after being known
 * offline. Returns an unsubscribe. Never fires for the optimistic "online"
 * we start out assuming — only for a real recovery.
 */
export function onReconnect(handler: () => void): () => void {
  reconnectHandlers.add(handler);
  return () => {
    reconnectHandlers.delete(handler);
  };
}
