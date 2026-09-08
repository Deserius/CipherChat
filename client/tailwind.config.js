import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(dir, 'index.html'),
    path.join(dir, 'src/**/*.{js,ts,jsx,tsx}'),
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05070b',
          900: '#080c14',
          850: '#0c111c',
          800: '#10182a',
          700: '#162038',
        },
        cyan: {
          glow: '#00e5ff',
          dim: '#0891b2',
        },
        mint: '#2ee6a6',
        violet: {
          glow: '#7c5cff',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(0, 229, 255, 0.12)',
        'glow-lg': '0 0 80px rgba(0, 229, 255, 0.16)',
        panel: '0 20px 60px rgba(0, 0, 0, 0.45)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.45' },
          '50%': { opacity: '1' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        scan: 'scan 8s linear infinite',
        fadeIn: 'fadeIn 0.45s ease-out both',
      },
    },
  },
  plugins: [],
};
