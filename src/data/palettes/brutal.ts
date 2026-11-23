import type { Palette } from './types';
/**
 * Brutalist: two colours and one accent (spec 8.3). The first five are the spike's (Blackout and Klein
 * were dark, the rest light); the other form and the last three are new.
 */
export const BRUTAL: Palette[] = [
  { id: 'concrete', name: 'Concrete',
    light: { ground: '#EDEDEA', ink: '#0A0A0A', accent: '#FF3B00' },
    dark: { ground: '#1C1C1B', ink: '#EDEDEA', accent: '#FF3B00' } },
  { id: 'blackout', name: 'Blackout',
    light: { ground: '#D8D8D4', ink: '#0A0A0A', accent: '#E8FF00' },
    dark: { ground: '#0A0A0A', ink: '#F2F2F0', accent: '#E8FF00' } },
  { id: 'hazard', name: 'Hazard',
    light: { ground: '#E8FF00', ink: '#0A0A0A', accent: '#FF3B00' },
    dark: { ground: '#0A0A0A', ink: '#E8FF00', accent: '#FF3B00' } },
  { id: 'alarm', name: 'Alarm',
    light: { ground: '#FF3B00', ink: '#0A0A0A', accent: '#F2F2F0' },
    dark: { ground: '#2A0B00', ink: '#FF5A1F', accent: '#F2F2F0' } },
  { id: 'klein', name: 'Klein',
    light: { ground: '#D8D8D4', ink: '#1F3BFF', accent: '#E8FF00' },
    dark: { ground: '#1F3BFF', ink: '#F2F2F0', accent: '#E8FF00' } },
  { id: 'steel', name: 'Steel',
    light: { ground: '#D9DDE1', ink: '#0B0D10', accent: '#0047FF' },
    dark: { ground: '#0B0D10', ink: '#D9DDE1', accent: '#5A82FF' } },
  { id: 'acid', name: 'Acid',
    light: { ground: '#F4F4F4', ink: '#111111', accent: '#00E05A' },
    dark: { ground: '#111111', ink: '#F4F4F4', accent: '#00E05A' } },
  { id: 'riot', name: 'Riot',
    light: { ground: '#FFD6E8', ink: '#0A0A0A', accent: '#FF0F7B' },
    dark: { ground: '#0A0A0A', ink: '#FFD6E8', accent: '#FF0F7B' } },
];
