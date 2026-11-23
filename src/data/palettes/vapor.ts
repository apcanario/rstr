import type { Palette } from './types';
/**
 * Vaporwave: ground is the floor, gradient the sky. Light mode is a pastel sky with dark ink (spec 8.4).
 * The first four are the spike's (Mint was light, the rest dark); the other form and the last four are new.
 */
const W = { window: '#F4F0FF', windowInk: '#1A0B3B', chrome: '#FFFFFF' };
const WL = { window: '#FFFFFF', windowInk: '#1A0B3B', chrome: '#FFFFFF' };
export const VAPOR: Palette[] = [
  { id: 'sunset', name: 'Sunset',
    light: { gradient: ['#FFE0F4', '#FFCDE9', '#FFD6C2', '#FFF0CC'], ground: '#FBF0FF', ink: '#2A0A4A', accent: '#FF4FB8', accent2: '#00A7E1', accent3: '#FFB347', ...WL },
    dark: { gradient: ['#120458', '#7A04EB', '#FF6AD5', '#FFB86B'], ground: '#12032E', ink: '#FFFFFF', accent: '#FF71CE', accent2: '#01CDFE', accent3: '#FFFB96', ...W } },
  { id: 'night', name: 'Night',
    light: { gradient: ['#E4DEFF', '#D6CCFF', '#F2C8E8', '#FFD8EC'], ground: '#EFEAFF', ink: '#1B0B4B', accent: '#FF2E97', accent2: '#00B884', accent3: '#FFD23F', ...WL },
    dark: { gradient: ['#05010F', '#1B0B4B', '#5B1E9E', '#FF2E97'], ground: '#07020F', ink: '#FFFFFF', accent: '#FF2E97', accent2: '#05FFA1', accent3: '#FFE66D', ...W } },
  { id: 'miami', name: 'Miami',
    light: { gradient: ['#BDEEFF', '#D6F6FB', '#FBD9FB', '#FEF0D5'], ground: '#FFF4F9', ink: '#2A0A5E', accent: '#FF5DA2', accent2: '#00B39B', accent3: '#FFD84D', ...WL },
    dark: { gradient: ['#00A6FB', '#7BDFF2', '#F7AEF8', '#FDE2A8'], ground: '#2A0A5E', ink: '#FFFFFF', accent: '#FF5DA2', accent2: '#00F5D4', accent3: '#FFF275', ...W } },
  { id: 'mint', name: 'Mint',
    light: { gradient: ['#C9FFF2', '#D9E8FF', '#FFD6F6', '#FFF3C4'], ground: '#F6EBFF', ink: '#2B1055', accent: '#FF5DA2', accent2: '#7A5CFF', accent3: '#00B8A9', ...WL },
    dark: { gradient: ['#03201F', '#0B3B4A', '#3A2A6B', '#B05AA8'], ground: '#0A0E24', ink: '#F0FFFB', accent: '#FF5DA2', accent2: '#7A5CFF', accent3: '#00E0C6', ...W } },
  { id: 'grape', name: 'Grape',
    light: { gradient: ['#F1E4FF', '#E8D3FA', '#F8D3E4', '#FFE6CF'], ground: '#F7F0FF', ink: '#2A0F4A', accent: '#CE4993', accent2: '#8A2BB0', accent3: '#FB9062', ...WL },
    dark: { gradient: ['#0D0221', '#261447', '#6A0D83', '#CE4993'], ground: '#0D0221', ink: '#FFFFFF', accent: '#EE5D6C', accent2: '#FB9062', accent3: '#EEAF61', ...W } },
  { id: 'outrun', name: 'Outrun',
    light: { gradient: ['#E3F6FF', '#DDE7FF', '#FFD9EC', '#FFF5CC'], ground: '#F0F7FF', ink: '#12083A', accent: '#F72585', accent2: '#3A86FF', accent3: '#FFBE0B', ...WL },
    dark: { gradient: ['#000000', '#0B0033', '#3A0838', '#F72585'], ground: '#050014', ink: '#FFFFFF', accent: '#F72585', accent2: '#4CC9F0', accent3: '#FFD60A', ...W } },
  { id: 'lagoon', name: 'Lagoon',
    light: { gradient: ['#E0FBFC', '#C2F0F7', '#E6E0FF', '#FFE8F3'], ground: '#F2FDFF', ink: '#08304A', accent: '#FF6FD8', accent2: '#0096C7', accent3: '#FFB703', ...WL },
    dark: { gradient: ['#001B2E', '#023E7D', '#0077B6', '#7FD4EA'], ground: '#001427', ink: '#FFFFFF', accent: '#FF6FD8', accent2: '#48CAE4', accent3: '#FFF3B0', ...W } },
  { id: 'peach', name: 'Peach',
    light: { gradient: ['#FFF1E6', '#FFDCCC', '#FBC4D6', '#E8D7FF'], ground: '#FFF6F0', ink: '#3A0F2E', accent: '#FF6B6B', accent2: '#9D4EDD', accent3: '#FFB347', ...WL },
    dark: { gradient: ['#1A0A1F', '#4A1942', '#C33C54', '#FF8C61'], ground: '#12060F', ink: '#FFFFFF', accent: '#FF8C61', accent2: '#00F5D4', accent3: '#FFE66D', ...W } },
];
