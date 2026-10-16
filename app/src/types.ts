export type Kind = 'instant' | 'hold' | 'checkin' | 'test' | 'intro';

export interface Loc {
  lat: number;
  lng: number;
  address?: string;
}

export interface Hashed {
  salt: string;
  hash: string;
}

export interface Settings {
  setupDone: boolean;
  name: string;
  template: string;
  contacts: string[];
  pin?: Hashed;
  duress?: Hashed;
  cancelHold: boolean;
  cancelCheckin: boolean;
  recordAudio: boolean;
  call911: 'off' | 'dialer' | 'dispatch';
  /** Opt-in sign that a server took an alert: 'icon' moves the decoy's weather icon, 'vibrate' buzzes once. */
  cue: 'off' | 'icon' | 'vibrate';
  /** Alternate decoy icon, or undefined for the default. */
  icon?: string;
  /** A remote wipe code has been registered (the code itself is never stored). */
  wipeSet?: boolean;
  /** Server base URL -> bearer token. */
  tokens: Record<string, string>;
}

export interface AlertPayload {
  id: string;
  kind: Kind;
  duress: boolean;
  template: string;
  contacts: string[];
  dispatch: boolean;
  loc?: Loc;
}

export interface AlertRecord {
  id: string;
  at: string;
  payload: AlertPayload;
  /** 'queued' until a server has accepted it. */
  state: 'queued' | 'sent';
  server?: string;
  safe?: boolean;
}

export interface Checkin {
  id: string;
  server: string;
  dueAt: string;
}

export interface State {
  settings: Settings;
  alerts: AlertRecord[];
  checkin?: Checkin;
  /** Safety plan checklist: item index -> done. */
  plan?: Record<number, boolean>;
  /** Latest weather shown by the decoy, mirrored into the widgets. */
  forecast?: { place: string; temp: string; summary: string };
}
