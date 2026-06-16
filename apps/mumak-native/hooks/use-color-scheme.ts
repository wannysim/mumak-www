import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme(): 'light' | 'dark' {
  const colorScheme = useRNColorScheme();
  return colorScheme === 'dark' ? 'dark' : 'light';
}
