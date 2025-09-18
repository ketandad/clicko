import { DefaultTheme } from 'react-native-paper';
import config from './config';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: config.colors.primary,
    accent: config.colors.secondary,
    background: config.colors.background,
    text: config.colors.text,
    placeholder: config.colors.textSecondary,
  },
};

// Export colors for direct usage in components
export const colors = config.colors;
