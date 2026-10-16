import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// `sdks/shared/fixtures` — the cases every SDK runs — exists only in the monorepo. The public mirror
// (ProofHoldings/sdk-js) has no copy, and the fixture README forbids one, so there the suites that load
// a shared fixture at module level, and so cannot even be collected without it, are left out; they run
// on every pull request to the monorepo.
const HAS_SHARED_FIXTURES = existsSync(new URL('../shared/fixtures', import.meta.url));
const NEEDS_SHARED_FIXTURES = [
  'src/__tests__/credentials-fixtures.test.ts',
  'src/__tests__/jwks-rotation-fixtures.test.ts',
  'src/__tests__/offline-revocation.test.ts',
  'tests/integration/resources.test.ts',
];

export default defineConfig({
  test: {
    exclude: ['**/._*', '**/node_modules/**', '**/dist/**', ...(HAS_SHARED_FIXTURES ? [] : NEEDS_SHARED_FIXTURES)],
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
      tsconfig: './tsconfig.typecheck.json',
    },
  },
});
