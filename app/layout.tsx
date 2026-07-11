import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Flappy Dusk — 3D Flappy Bird',
  description: 'A pretty, playable, web-based 3D flappy-bird game with coins, power-ups, and daily missions.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2a1f3d',
