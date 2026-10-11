import '@/lib/polyfills';

import {
  CormorantGaramond_300Light, CormorantGaramond_300Light_Italic, CormorantGaramond_400Regular,
  CormorantGaramond_400Regular_Italic, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold,
  CormorantGaramond_600SemiBold_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_300Light, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold, useFonts,
} from '@expo-google-fonts/dm-sans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Splash } from '@/components/Splash';
import { ToastHost } from '@/lib/toast';
import { AuthProvider, PENDING_INVITE, useAuth } from '@/providers/AuthProvider';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Ссылка-приглашение: в вебе ?invite=CODE, в приложении loveapp://invite?code=CODE
function useInviteLinks() {
  const url = Linking.useLinkingURL();
  useEffect(() => {
    if (!url) return;
    const { queryParams } = Linking.parse(url);
    const code = (queryParams?.invite ?? queryParams?.code) as string | undefined;
    if (code) AsyncStorage.setItem(PENDING_INVITE, code).catch(() => {});
  }, [url]);
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { session, needsOnboarding, initializing } = useAuth();
  useInviteLinks();
  const loading = initializing || !fontsReady;

  useEffect(() => {
    // нативный сплэш сразу меняем на анимированный из веба
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (loading) return <Splash />;

  const signedIn = !!session;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsOnboarding}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsReady] = useFonts({
    CormorantGaramond_300Light, CormorantGaramond_300Light_Italic, CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic, CormorantGaramond_500Medium, CormorantGaramond_600SemiBold,
    CormorantGaramond_600SemiBold_Italic,
    DMSans_300Light, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold,
  });
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <View style={{ flex: 1 }}>
            <RootNavigator fontsReady={fontsReady} />
            <ToastHost />
          </View>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
