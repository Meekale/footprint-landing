import { StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import TorsoScanner from './src/TorsoScanner';
import { ui } from './src/ui';

export default function App() {
  return <SafeAreaProvider>
    <SafeAreaView style={ui.screen}>
      <StatusBar barStyle="light-content" />
      <TorsoScanner />
    </SafeAreaView>
  </SafeAreaProvider>;
}
