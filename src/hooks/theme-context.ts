import { createContext, useContext } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeContextValue = {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  isLoaded: boolean;
  error: string;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useAppColorScheme() {
  const theme = useContext(ThemeContext);
  const systemColorScheme = useSystemColorScheme();
  return theme?.colorScheme ?? systemColorScheme;
}

export function useThemePreference() {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useThemePreference must be used within the app theme provider.');
  }
  return theme;
}
