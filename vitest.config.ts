import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts', 'levels/*/src/**/*.test.ts'],
    environment: 'node',
  },
});
