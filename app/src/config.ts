// Backend deployments, tried in order. Set in .env (see .env.example).
export const SERVERS = [process.env.EXPO_PUBLIC_API_PRIMARY, process.env.EXPO_PUBLIC_API_SECONDARY]
  .filter((s): s is string => !!s)
  .map((s) => s.replace(/\/$/, ''));

// Show the 911 dispatch option only once a dispatch partner is configured on the servers.
export const DISPATCH_ENABLED = process.env.EXPO_PUBLIC_DISPATCH_ENABLED === 'true';

export const SERVER_TIMEOUT_MS = 3000;
export const COUNTDOWN_SECONDS = 10;
export const DEFAULT_PLACE = { name: 'South Bend', lat: 41.6764, lng: -86.252 };

// Shared with the iOS widget; must match ios.entitlements in app.json and targets/widget/Shared.swift.
export const APP_GROUP = 'group.com.example.skyline';
