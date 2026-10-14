import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/._*', '**/node_modules/**', '**/dist/**'],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
      tsconfig: './tsconfig.typecheck.json',
    },
  },
});
