let owner: symbol | null = null;
export function acquireAudioSession(candidate: symbol): boolean {
  if (owner !== null) return false;
  owner = candidate;
  return true;
}
export function ownsAudioSession(candidate: symbol): boolean {
  return owner === candidate;
}
export function releaseAudioSession(candidate: symbol): void {
  if (owner === candidate) owner = null;
}
