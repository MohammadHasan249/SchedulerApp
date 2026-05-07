import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  css: {
    postcss: null,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@scheduler/database': path.resolve(__dirname, '../../packages/database/src'),
      '@scheduler/database/schema': path.resolve(__dirname, '../../packages/database/src/schema/index.ts'),
      '@scheduler/types': path.resolve(__dirname, '../../packages/types/src'),
      '@scheduler/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
    }
  },
});
