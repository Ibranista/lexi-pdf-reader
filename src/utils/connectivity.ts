import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

let online = true;

const readState = (state: NetInfoState) => {
  online = state.isConnected !== false && state.isInternetReachable !== false;
};

NetInfo.addEventListener(readState);
NetInfo.fetch().then(readState).catch(() => {});

export function isOnline(): boolean {
  return online;
}
