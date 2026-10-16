import { requireOptionalNativeModule } from 'expo';

// Hands the send-only server config and the forecast to a paired Apple Watch (WatchConnectivity)
// or Wear OS watch (Wearable Data Layer). Empty strings clear the watch (remote wipe).
const native = requireOptionalNativeModule<{ send(config: string, forecast: string): Promise<boolean> }>('WatchLink');

export const sendToWatch = async (config: string, forecast: string) => (native ? native.send(config, forecast) : false);
