import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import './src/background'; // background tasks must be defined at start-up, before any UI
import { widgetTaskHandler } from './src/widget/handler';

registerRootComponent(App);
if (Platform.OS === 'android') registerWidgetTaskHandler(widgetTaskHandler);
