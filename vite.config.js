import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel serves this app from the domain root; Capacitor bundles the same assets locally.
export default defineConfig({ plugins: [react()], base: '/' });
