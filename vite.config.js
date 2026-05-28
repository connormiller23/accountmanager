import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev + preview both run on localhost:8000.
export default defineConfig({
  plugins: [react()],
  server: { port: 8000, host: true, strictPort: true, open: false },
  preview: { port: 8000, host: true, strictPort: true },
});
