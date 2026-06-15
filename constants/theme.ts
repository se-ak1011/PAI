// PAI Design System — Dark Slate + Brass Industrial Palette
// Contractor operating system: gunmetal surfaces, aged-brass accents,
// hard edges, dense practical typography. No purple, no luxury gold.
export const Colors = {
  // Surfaces — dark slate / gunmetal
  bg: '#12171C',
  surface: '#161B21',
  surfaceAlt: '#1A2026',
  card: '#1A2026',
  cardAlt: '#222A33',
  border: '#313B47',
  borderSubtle: '#262E37',

  // Brand — aged brass (industrial, not jewellery)
  primary: '#B08D57',
  primaryLight: '#D4AF6A',
  primaryDim: '#2A2316',
  primaryGlow: '#D4AF6A',

  // Brass-tinted off-white for brand wordmark text if rendered in code
  logoText: '#E8E2D6',

  // Text
  textPrimary: '#F5F7FA',
  textSecondary: '#A3ADB8',
  textMuted: '#6B7682',
  textInverse: '#12171C',

  // Semantic
  success: '#4F8A63',
  successDim: '#16271C',
  warning: '#D4AF6A',
  warningDim: '#2A2316',
  error: '#B85757',
  errorDim: '#2A1719',
  info: '#6E8597',
  infoDim: '#1B2530',

  // Tabs & Nav
  tabActive: '#B08D57',
  tabInactive: '#5C6670',
  tabBg: '#12171C',

  // Financial
  income: '#4F8A63',
  expense: '#B85757',
  taxPot: '#B08D57',
};

export const Typography = {
  // Brand / Headings — strong, tight, practical (no italics)
  brandXL: { fontSize: 32, fontWeight: '800' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  brandLG: { fontSize: 26, fontWeight: '800' as const, color: Colors.textPrimary, letterSpacing: -0.4 },
  brandMD: { fontSize: 21, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.3 },
  brandSM: { fontSize: 17, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.2 },

  // Utility — all utility text
  labelXS: { fontSize: 10, fontWeight: '600' as const, color: Colors.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  labelSM: { fontSize: 12, fontWeight: '500' as const, color: Colors.textSecondary, letterSpacing: 0.6 },
  labelMD: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  bodyMD: { fontSize: 15, fontWeight: '400' as const, color: Colors.textPrimary, lineHeight: 22 },
  bodySM: { fontSize: 13, fontWeight: '400' as const, color: Colors.textSecondary, lineHeight: 19 },
  dataMD: { fontSize: 15, fontWeight: '600' as const, color: Colors.textPrimary },
  dataLG: { fontSize: 22, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.3 },
  dataXL: { fontSize: 32, fontWeight: '800' as const, color: Colors.textPrimary, letterSpacing: -0.5 },
  btnMD: { fontSize: 15, fontWeight: '700' as const },
  btnSM: { fontSize: 13, fontWeight: '700' as const },
  headingMD: { fontSize: 18, fontWeight: '700' as const, color: Colors.textPrimary, letterSpacing: -0.2 },
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
  sm: 4,
  md: 8,
  lg: 10,
  xl: 14,
  pill: 100,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 16,
  },
};
