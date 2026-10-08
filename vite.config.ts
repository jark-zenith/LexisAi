import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Security: Guarantee that secret keys (sk_...) are never exposed to client bundles
if (process.env.VITE_PAYSTACK_PUBLIC_KEY && process.env.VITE_PAYSTACK_PUBLIC_KEY.startsWith('sk_')) {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    process.env.PAYSTACK_SECRET_KEY = process.env.VITE_PAYSTACK_PUBLIC_KEY;
  }
  delete process.env.VITE_PAYSTACK_PUBLIC_KEY;
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
