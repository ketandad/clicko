import { DefaultTheme } from 'react-native-paper';
import { colors } from './config';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.secondary,
    background: colors.background,
    text: colors.textPrimary,
    placeholder: colors.textSecondary,
  },
};
