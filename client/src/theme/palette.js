

// ----------------------------------------------------------------------

// Setup colors matching a premium dark OTT platform (charcoal & crimson/red)
const GREY = {
  0: '#FFFFFF',
  100: '#F9FAFB',
  200: '#F4F6F8',
  300: '#DFE3E8',
  400: '#C4CDD5',
  500: '#919EAB',
  600: '#637381',
  700: '#454F5B',
  800: '#212B36',
  900: '#161C24',
};

// StreamSphere Premium Crimson Red Primary
const PRIMARY = {
  lighter: '#FFA39E',
  light: '#FF4D4F',
  main: '#E50914', // Cinematic red
  dark: '#A8071A',
  darker: '#5C0011',
  contrastText: '#fff',
};

const SECONDARY = {
  lighter: '#D6E4FF',
  light: '#84A9FF',
  main: '#1F2937', // Deep slate gray
  dark: '#111827',
  darker: '#030712',
  contrastText: '#fff',
};

const INFO = {
  lighter: '#D0F2FF',
  light: '#74CAFF',
  main: '#1890FF',
  dark: '#0C53B7',
  darker: '#04297A',
  contrastText: '#fff',
};

const SUCCESS = {
  lighter: '#E9FCD4',
  light: '#AAF27F',
  main: '#54D62C',
  dark: '#229A16',
  darker: '#08660D',
  contrastText: '#1F2937',
};

const WARNING = {
  lighter: '#FFF7CD',
  light: '#FFE16A',
  main: '#FFC107',
  dark: '#B78103',
  darker: '#7A4F01',
  contrastText: '#1F2937',
};

const ERROR = {
  lighter: '#FFE7D9',
  light: '#FFA48D',
  main: '#FF4842',
  dark: '#B72136',
  darker: '#7A0C2E',
  contrastText: '#fff',
};

const commonPalette = {
  common: { black: '#000', white: '#fff' },
  primary: PRIMARY,
  secondary: SECONDARY,
  info: INFO,
  success: SUCCESS,
  warning: WARNING,
  error: ERROR,
  grey: GREY,
};

const palette = {
  light: {
    ...commonPalette,
    mode: 'light',
    divider: 'rgba(0, 0, 0, 0.08)',
    text: {
      primary: '#161C24',
      secondary: '#637381',
      disabled: '#919EAB',
    },
    background: {
      paper: '#FFFFFF',
      default: '#F9FAFB',
      neutral: '#F4F6F8',
    },
    action: {
      active: '#637381',
      hover: 'rgba(145, 158, 171, 0.08)',
      selected: 'rgba(145, 158, 171, 0.16)',
      disabled: 'rgba(145, 158, 171, 0.3)',
      disabledBackground: 'rgba(145, 158, 171, 0.24)',
      focus: 'rgba(145, 158, 171, 0.24)',
      hoverOpacity: 0.08,
      disabledOpacity: 0.48,
    },
  },
  dark: {
    ...commonPalette,
    mode: 'dark',
    divider: 'rgba(255, 255, 255, 0.08)',
    text: {
      primary: '#FFFFFF',
      secondary: '#B3B3B3',
      disabled: '#555555',
    },
    background: {
      paper: '#141414',
      default: '#080808',
      neutral: '#222222',
    },
    action: {
      active: '#FFFFFF',
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
      focus: 'rgba(255, 255, 255, 0.12)',
      hoverOpacity: 0.08,
      disabledOpacity: 0.48,
    },
  },
};

// Expose static properties for modules that import palette statically (e.g. shadows, customShadows)
palette.grey = GREY;
palette.primary = PRIMARY;
palette.secondary = SECONDARY;
palette.info = INFO;
palette.success = SUCCESS;
palette.warning = WARNING;
palette.error = ERROR;

export default palette;
