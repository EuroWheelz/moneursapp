import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/lib/colors';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Splash verbergen na initialisatie
    const init = async () => {
      await new Promise((r) => setTimeout(r, 300));
      setReady(true);
      await SplashScreen.hideAsync();
    };
    init();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor={Colors.green} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="opdracht/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Opdracht',
            headerStyle: { backgroundColor: Colors.green },
            headerTintColor: Colors.white,
            headerTitleStyle: { fontWeight: '700' },
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="opdracht/[id]/afwikkelen"
          options={{
            headerShown: true,
            headerTitle: 'Afwikkelen',
            headerStyle: { backgroundColor: Colors.green },
            headerTintColor: Colors.white,
            headerTitleStyle: { fontWeight: '700' },
            presentation: 'modal',
          }}
        />
      </Stack>
    </GestureHandlerRootView>
  );
}
