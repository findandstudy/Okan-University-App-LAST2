import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    timeout: 10000,
    isolate: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
