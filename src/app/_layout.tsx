import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { PropsWithChildren, useEffect, useState } from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { ThemeContext, ThemePreference, useThemePreference } from '@/hooks/theme-context';

SplashScreen.preventAutoHideAsync();

const THEME_STORAGE_KEY = 'timeds-app:theme-preference';

function AppThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState('');
  const colorScheme =
    Platform.OS === 'web' && !isLoaded
      ? 'light'
      : preference === 'dark' || (preference === 'system' && systemColorScheme === 'dark')
        ? 'dark'
        : 'light';

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedPreference) => {
        if (
          isMounted &&
          (savedPreference === 'system' ||
            savedPreference === 'light' ||
            savedPreference === 'dark')
        ) {
          setPreferenceState(savedPreference);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(
            `Could not load the saved appearance preference: ${
              loadError instanceof Error ? loadError.message : 'An unexpected error occurred.'
            }`,
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function setPreference(nextPreference: ThemePreference) {
    setPreferenceState(nextPreference);
    setError('');
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    } catch (saveError) {
      setError(
        `Appearance changed, but could not be saved: ${
          saveError instanceof Error ? saveError.message : 'An unexpected error occurred.'
        }`,
      );
    }
  }

  return (
    <ThemeContext.Provider
      value={{ colorScheme, preference, isLoaded, error, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

function TabLayoutContent() {
  const { colorScheme } = useThemePreference();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

export default function TabLayout() {
  return (
    <AppThemeProvider>
      <TabLayoutContent />
    </AppThemeProvider>
  );
}
