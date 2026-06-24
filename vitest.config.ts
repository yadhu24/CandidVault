import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve the '@/...' path alias the same way tsconfig does.
const rootDir = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  resolve: {
    alias: { '@': rootDir },
  },
  test: {
    environment: 'node',
    // E2E specs live under tests/e2e and are run by Playwright, not Vitest.
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: ['**/*.d.ts', '**/types.ts'],
    },
  },
})
