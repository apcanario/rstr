import type { Palette } from './types';
/**
 * Postmodern: three accents plus ink and ground (spec 8.2). The first four are the spike's (Arcade was
 * dark, the rest light); the other form and the last four are new.
 */
export const POMO: Palette[] = [
  { id: 'milano', name: 'Milano',
    light: { ground: '#F3EAD8', ink: '#141414', accent: '#FF4F9A', accent2: '#00A7A0', accent3: '#FFD23F' },
    dark: { ground: '#1D1A2B', ink: '#F3EAD8', accent: '#FF4F9A', accent2: '#00B8B0', accent3: '#FFD23F' } },
  { id: 'arcade', name: 'Arcade',
    light: { ground: '#F6F0E2', ink: '#1B1B3A', accent: '#FF6B35', accent2: '#39D0C0', accent3: '#F7D002' },
    dark: { ground: '#1B1B3A', ink: '#F3EAD8', accent: '#FF6B35', accent2: '#39D0C0', accent3: '#F7D002' } },
  { id: 'citrus', name: 'Citrus',
    light: { ground: '#FFD23F', ink: '#141414', accent: '#3A36DB', accent2: '#FF4F4F', accent3: '#F7F1E3' },
    dark: { ground: '#17153F', ink: '#FFE9A8', accent: '#FF4F4F', accent2: '#FFD23F', accent3: '#F7F1E3' } },
  { id: 'lilac', name: 'Lilac',
    light: { ground: '#E8E4F0', ink: '#19161F', accent: '#7B2FF7', accent2: '#FF7A59', accent3: '#19C3A6' },
    dark: { ground: '#1B1724', ink: '#E8E4F0', accent: '#A06BFF', accent2: '#FF7A59', accent3: '#19C3A6' } },
  { id: 'bubblegum', name: 'Bubblegum',
    light: { ground: '#FFE4EE', ink: '#1A1033', accent: '#2248E8', accent2: '#FF5C8A', accent3: '#B8F25C' },
    dark: { ground: '#1A1033', ink: '#FFE4EE', accent: '#FF5C8A', accent2: '#B8F25C', accent3: '#7FA0FF' } },
  { id: 'terrazzo', name: 'Terrazzo',
    light: { ground: '#F2EDE4', ink: '#222222', accent: '#E85D3F', accent2: '#1F64A8', accent3: '#F2B134' },
    dark: { ground: '#232220', ink: '#F2EDE4', accent: '#E85D3F', accent2: '#4A9BDE', accent3: '#F2B134' } },
  { id: 'lagoon', name: 'Lagoon',
    light: { ground: '#D9F2EE', ink: '#102A2E', accent: '#FF6F59', accent2: '#2B59C3', accent3: '#FFE156' },
    dark: { ground: '#0E2629', ink: '#D9F2EE', accent: '#FF6F59', accent2: '#5C8DFF', accent3: '#FFE156' } },
  { id: 'riso', name: 'Riso',
    light: { ground: '#FAF6EF', ink: '#1B1B1B', accent: '#FF48B0', accent2: '#006BB0', accent3: '#FFE800' },
    dark: { ground: '#1B1B1B', ink: '#FAF6EF', accent: '#FF48B0', accent2: '#3D9BE9', accent3: '#FFE800' } },
];
