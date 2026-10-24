import type { Config } from 'tailwindcss';
const c = (n: string) => `rgb(var(--${n}) / <alpha-value>)`;
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { bg: c('bg'), panel: c('panel'), line: c('line'), ink: c('ink'), mute: c('mute'), accent: c('accent'), ok: c('ok'), warn: c('warn'), bad: c('bad'), info: c('info') } } },
  plugins: [],
};
export default config;
