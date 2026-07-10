export type ThemeColors = {
  primary: string;
  askMode: string;
  selected: string;
  thinking: string;
  success: string;
  error: string;
  info: string;
  background: string;
  surface: string;
  dialogSurface: string;
  thinkingBorder: string;
  dimSeparator: string;
};

export type Theme = {
  name: string;
  colors: ThemeColors;
};

export const THEMES: Theme[] = [
  {
    name: 'Nightfox',
    colors: {
      primary: '#7aa2f7',
      askMode: '#7aa2f7',
      selected: '#7aa2f7',
      thinking: '#7aa2f7',
      success: '#9ece6a',
      error: '#f7768e',
      info: '#7dcfff',
      background: '#24283b',
      surface: '#1f2335',
      dialogSurface: '#1f2335',
      thinkingBorder: '#7aa2f7',
      dimSeparator: '#414868',
    },
  },
  {
    name: 'Rosé Pine',
    colors: {
      primary: '#c4a7e7',
      askMode: '#c4a7e7',
      selected: '#c4a7e7',
      thinking: '#c4a7e7',
      success: '#31748f',
      error: '#eb6f92',
      info: '#9ccfd8',
      background: '#191724',
      surface: '#1f1d2e',
      dialogSurface: '#1f1d2e',
      thinkingBorder: '#c4a7e7',
      dimSeparator: '#403d52',
    },
  },
  {
    name: 'Catppuccin Mocha',
    colors: {
      primary: '#cba6f7',
      askMode: '#cba6f7',
      selected: '#cba6f7',
      thinking: '#cba6f7',
      success: '#a6e3a1',
      error: '#f38ba8',
      info: '#89dceb',
      background: '#1e1e2e',
      surface: '#181825',
      dialogSurface: '#181825',
      thinkingBorder: '#cba6f7',
      dimSeparator: '#45475a',
    },
  },
  {
    name: 'Claude Code',
    colors: {
      primary: '#da7756',
      askMode: '#da7756',
      selected: '#da7756',
      thinking: '#da7756',
      success: '#7db88f',
      error: '#e06c75',
      info: '#7aadcc',
      background: '#1a1915',
      surface: '#141410',
      dialogSurface: '#141410',
      thinkingBorder: '#da7756',
      dimSeparator: '#3a3a35',
    },
  },
];

export const DEFAULT_THEME = THEMES.find((theme) => theme.name === 'Nightfox')!;
