'use client';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '@/lib/colors';
import { AuthProvider, useAuth } from '@/lib/auth-context';

SplashScreen.preventAutoHideAsync();

function NavigatieWacht() {
  const { monteur, laden } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (laden) return;

    const inAuth = segments[0] === '(auth)';

    if (!monteur && !inAuth) {
      router.replace('/(auth)');
    } else if (monteur && inAuth) {
      router.replace('/(tabs)');
    }
  }, [monteur, laden, segments]);

  useEffect(() => {
    if (!laden) SplashScreen.hideAsync();
  }, [laden]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" backgroundColor={Colors.green} />
        <NavigatieWacht />
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
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
