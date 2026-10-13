import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset URLs work both at Vercel's domain root and inside Capacitor's local WebView.
export default defineConfig({ plugins: [react()], base: './' });
