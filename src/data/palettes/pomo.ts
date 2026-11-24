import type { Palette } from './types';
/**
 * Postmodern: three accents plus ink and ground (spec 8.2). The first four are the spike's (Arcade was
 * dark, the rest light); the other form and the last four are new. Paper, toner and spot are the photocopy
 * dialect's (spec 8.2), after the spike's grunge palettes (Paper, Xerox, Acid, Ink blue, Rust): Riso has no spot.
 */
export const POMO: Palette[] = [
  { id: 'milano', name: 'Milano',
    light: { ground: '#F3EAD8', ink: '#141414', accent: '#FF4F9A', accent2: '#00A7A0', accent3: '#FFD23F', paper: '#E9E3D5', toner: '#121212', spot: '#FF4F9A' },
    dark: { ground: '#1D1A2B', ink: '#F3EAD8', accent: '#FF4F9A', accent2: '#00B8B0', accent3: '#FFD23F', paper: '#121212', toner: '#ECE6D8', spot: '#FF4F9A' } },
  { id: 'arcade', name: 'Arcade',
    light: { ground: '#F6F0E2', ink: '#1B1B3A', accent: '#FF6B35', accent2: '#39D0C0', accent3: '#F7D002', paper: '#E7E2D6', toner: '#101010', spot: '#FF6B35' },
    dark: { ground: '#1B1B3A', ink: '#F3EAD8', accent: '#FF6B35', accent2: '#39D0C0', accent3: '#F7D002', paper: '#141414', toner: '#E9E6DC', spot: '#FF6B35' } },
  { id: 'citrus', name: 'Citrus',
    light: { ground: '#FFD23F', ink: '#141414', accent: '#3A36DB', accent2: '#FF4F4F', accent3: '#F7F1E3', paper: '#ECE5C9', toner: '#141414', spot: '#3A36DB' },
    dark: { ground: '#17153F', ink: '#FFE9A8', accent: '#FF4F4F', accent2: '#FFD23F', accent3: '#F7F1E3', paper: '#121212', toner: '#FFE9A8', spot: '#FFD23F' } },
  { id: 'lilac', name: 'Lilac',
    light: { ground: '#E8E4F0', ink: '#19161F', accent: '#7B2FF7', accent2: '#FF7A59', accent3: '#19C3A6', paper: '#DCDAD3', toner: '#111111', spot: '#6522E0' },
    dark: { ground: '#1B1724', ink: '#E8E4F0', accent: '#A06BFF', accent2: '#FF7A59', accent3: '#19C3A6', paper: '#121014', toner: '#E8E4F0', spot: '#A06BFF' } },
  { id: 'bubblegum', name: 'Bubblegum',
    light: { ground: '#FFE4EE', ink: '#1A1033', accent: '#2248E8', accent2: '#FF5C8A', accent3: '#B8F25C', paper: '#E9E4DE', toner: '#121212', spot: '#2248E8' },
    dark: { ground: '#1A1033', ink: '#FFE4EE', accent: '#FF5C8A', accent2: '#B8F25C', accent3: '#7FA0FF', paper: '#101010', toner: '#E9E6DC', spot: '#D9FF2F' } },
  { id: 'terrazzo', name: 'Terrazzo',
    light: { ground: '#F2EDE4', ink: '#222222', accent: '#E85D3F', accent2: '#1F64A8', accent3: '#F2B134', paper: '#D8D0BE', toner: '#151210', spot: '#93370B' },
    dark: { ground: '#232220', ink: '#F2EDE4', accent: '#E85D3F', accent2: '#4A9BDE', accent3: '#F2B134', paper: '#151210', toner: '#E2D9C6', spot: '#E85D3F' } },
  { id: 'lagoon', name: 'Lagoon',
    light: { ground: '#D9F2EE', ink: '#102A2E', accent: '#FF6F59', accent2: '#2B59C3', accent3: '#FFE156', paper: '#E7E2D6', toner: '#101010', spot: '#1C3FD1' },
    dark: { ground: '#0E2629', ink: '#D9F2EE', accent: '#FF6F59', accent2: '#5C8DFF', accent3: '#FFE156', paper: '#0E1414', toner: '#D9F2EE', spot: '#FF6F59' } },
  { id: 'riso', name: 'Riso',
    light: { ground: '#FAF6EF', ink: '#1B1B1B', accent: '#FF48B0', accent2: '#006BB0', accent3: '#FFE800', paper: '#D9D7D0', toner: '#111111', spot: '#111111' },
    dark: { ground: '#1B1B1B', ink: '#FAF6EF', accent: '#FF48B0', accent2: '#3D9BE9', accent3: '#FFE800', paper: '#101010', toner: '#E9E6DC', spot: '#E9E6DC' } },
];
