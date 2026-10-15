import { createContext } from 'react';

// Storybook globals own the selection; examples only read the current theme.
export const LabThemeContext = createContext<'light' | 'dark'>('light');
