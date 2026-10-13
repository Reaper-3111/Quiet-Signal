import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

interface Props { place: string; temp: string; summary: string }

/** Looks like a stock weather widget. "Radar" is the instant alert, "Hourly" opens the hold screen. */
export function WeatherWidget({ place, temp, summary }: Props) {
  const white = { color: '#ffffff' as const };
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#2c6fb7', borderRadius: 16, padding: 12, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ flexDirection: 'column' }}>
        <TextWidget text={place} style={{ fontSize: 12, ...white }} />
        <TextWidget text={temp} style={{ fontSize: 34, ...white }} />
        <TextWidget text={summary} style={{ fontSize: 12, ...white }} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', width: 'match_parent' }}>
        <TextWidget text="Radar" clickAction="ALERT" style={{ fontSize: 13, ...white }} />
        <TextWidget text="Hourly" clickAction="OPEN_URI" clickActionData={{ uri: 'skyline://hold' }} style={{ fontSize: 13, ...white }} />
      </FlexWidget>
    </FlexWidget>
  );
}
