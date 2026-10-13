// Backend deployments, tried in order. Set in .env (see .env.example).
export const SERVERS = [process.env.EXPO_PUBLIC_API_PRIMARY, process.env.EXPO_PUBLIC_API_SECONDARY]
  .filter((s): s is string => !!s)
  .map((s) => s.replace(/\/$/, ''));

export const SERVER_TIMEOUT_MS = 3000;
export const COUNTDOWN_SECONDS = 10;
export const DEFAULT_PLACE = { name: 'South Bend', lat: 41.6764, lng: -86.252 };
