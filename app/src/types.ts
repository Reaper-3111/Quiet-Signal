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
}
