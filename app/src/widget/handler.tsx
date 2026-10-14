import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { env } from '../api';
import { sendAlert } from '../fire';
import { load } from '../storage';
import { WeatherWidget } from './WeatherWidget';

// No Messages composer or dialer from a widget tap; a failed send stays queued for the app.
const silentEnv = { ...env, compose: async () => false, dial911: async () => {} };

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const f = (await load()).forecast;
      props.renderWidget(<WeatherWidget place={f?.place ?? ''} temp={f?.temp ?? '--'} summary={f?.summary ?? 'Updating'} />);
      break;
    }
    case 'WIDGET_CLICK':
      if (props.clickAction === 'ALERT') await sendAlert('instant', false, silentEnv);
      break;
  }
}
