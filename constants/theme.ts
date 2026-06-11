// PAI Design System — Industrial Palette
export const Colors = {
  // Surfaces
  bg: '#0E0E14',
  surface: '#121217',
  surfaceAlt: '#181320',
  card: '#1A1A24',
  cardAlt: '#1E1E2A',
  border: '#2A2A38',
  borderSubtle: '#1E1E28',

  // Brand — matched to official logo palette
  primary: '#4A2A68',
  primaryLight: '#7C5E9B',
  primaryDim: '#2E1A42',
  primaryGlow: '#9B78C8',

  // Logo cream — use for brand wordmark text if rendered in code
  logoText: '#EDE8E0',

  // Text
  textPrimary: '#F0F0F8',
  textSecondary: '#9090A8',
  textMuted: '#5A5A72',
  textInverse: '#FFFFFF',

  // Semantic
  success: '#9B78C8',
  successDim: '#2E1A42',
  warning: '#7C5E9B',
  warningDim: '#2A1A3A',
  error: '#C25A6E',
  errorDim: '#3A1A22',
  info: '#8B7AB8',
  infoDim: '#1E1632',

  // Tabs & Nav
  tabActive: '#4A2A68',
  tabInactive: '#4A4A62',
  tabBg: '#0E0E14',

  // Financial
  income: '#9B78C8',
  expense: '#C25A6E',
  taxPot: '#7C5E9B',
};

export const Typography = {
  // Brand / Editorial — use for page titles, greetings, headers
  brandXL: { fontSize: 38, fontStyle: 'italic' as const, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  brandLG: { fontSize: 30, fontStyle: 'italic' as const, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  brandMD: { fontSize: 24, fontStyle: 'italic' as const, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.3 },
  brandSM: { fontSize: 20, fontStyle: 'italic' as const, fontWeight: '600' as const, color: Colors.textPrimary },

  // Geist Utility — all utility text
  labelXS: { fontSize: 10, fontWeight: '500' as const, color: Colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  labelSM: { fontSize: 12, fontWeight: '500' as const, color: Colors.textSecondary, letterSpacing: 0.8 },
  labelMD: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  bodyMD: { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary, lineHeight: 22 },
  bodySM: { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary, lineHeight: 19 },
  dataMD: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary },
  dataLG: { fontSize: 22, fontWeight: '700' as const, color: Colors.textPrimary },
  dataXL: { fontSize: 32, fontWeight: '700' as const, color: Colors.textPrimary },
  btnMD: { fontSize: 15, fontWeight: '600' as const },
  btnSM: { fontSize: 13, fontWeight: '600' as const },
  headingMD: { fontSize: 18, fontWeight: '600' as const, color: Colors.textPrimary },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 100,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
};
