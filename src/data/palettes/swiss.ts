import type { Palette } from './types';
/**
 * Swiss: ground, ink and one accent, nothing else (spec 8.1). The first six are the spike's, each in the
 * form it had there (Night and Pine were dark, the rest light); the other form and the last two are new.
 */
export const SWISS: Palette[] = [
  { id: 'paper', name: 'Paper',
    light: { ground: '#F2EFE8', ink: '#161616', accent: '#E4002B' },
    dark: { ground: '#171615', ink: '#F2EFE8', accent: '#F0233F' } },
  { id: 'signal', name: 'Signal',
    light: { ground: '#E4002B', ink: '#FFFFFF', accent: '#161616' },
    dark: { ground: '#7A0016', ink: '#FFFFFF', accent: '#161616' } },
  { id: 'night', name: 'Night',
    light: { ground: '#E6E3DC', ink: '#111113', accent: '#F04E24' },
    dark: { ground: '#111113', ink: '#EDEAE3', accent: '#FF5A36' } },
  { id: 'yellow', name: 'Yellow',
    light: { ground: '#F6C700', ink: '#141414', accent: '#141414' },
    dark: { ground: '#141414', ink: '#F7F4EE', accent: '#F6C700' } },
  { id: 'cobalt', name: 'Cobalt',
    light: { ground: '#F2EFE8', ink: '#161616', accent: '#1B3FAB' },
    dark: { ground: '#0D1838', ink: '#F2EFE8', accent: '#4C78FF' } },
  { id: 'pine', name: 'Pine',
    light: { ground: '#EEEDE6', ink: '#10241D', accent: '#0F5B46' },
    dark: { ground: '#0F5B46', ink: '#F2EFE8', accent: '#F6C700' } },
  { id: 'orange', name: 'Orange',
    light: { ground: '#EFEDE6', ink: '#1A1A1A', accent: '#FF5F00' },
    dark: { ground: '#1A1A1A', ink: '#EFEDE6', accent: '#FF6A13' } },
  { id: 'magenta', name: 'Magenta',
    light: { ground: '#F4EEEA', ink: '#1A1416', accent: '#D6006F' },
    dark: { ground: '#1A1416', ink: '#F4EEEA', accent: '#FF2E93' } },
];
