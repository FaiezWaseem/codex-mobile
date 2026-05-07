export type AppTheme = {
  mode: 'light' | 'dark';
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    surfaceMuted: string;
    text: string;
    textMuted: string;
    border: string;
    shadow: string;
    primary: string;
    primarySoft: string;
    success: string;
    input: string;
    overlay: string;
  };
};

export const lightTheme: AppTheme = {
  mode: 'light',
  colors: {
    background: '#F5F2ED',
    surface: '#FFFFFF',
    surfaceElevated: '#FBFAF8',
    surfaceMuted: '#E8E2DA',
    text: '#171717',
    textMuted: '#7E7B76',
    border: '#E6DED4',
    shadow: 'rgba(31, 22, 13, 0.12)',
    primary: '#5A30B5',
    primarySoft: '#EFE8FF',
    success: '#27C07D',
    input: '#F7F5F1',
    overlay: 'rgba(20, 16, 12, 0.38)',
  },
};

export const darkTheme: AppTheme = {
  mode: 'dark',
  colors: {
    background: '#12100D',
    surface: '#1B1814',
    surfaceElevated: '#221E19',
    surfaceMuted: '#2A251F',
    text: '#F8F3EC',
    textMuted: '#AEA69A',
    border: '#332D25',
    shadow: 'rgba(0, 0, 0, 0.32)',
    primary: '#8A63F6',
    primarySoft: '#2A213F',
    success: '#34D399',
    input: '#211C17',
    overlay: 'rgba(0, 0, 0, 0.52)',
  },
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 36,
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
};
