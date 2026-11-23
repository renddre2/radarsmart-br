import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@data': path.resolve(__dirname, 'data'),
      '@config': path.resolve(__dirname, 'config'),
    },
  },
});
