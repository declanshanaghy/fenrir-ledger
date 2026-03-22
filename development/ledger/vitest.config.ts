import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 10000,
    hookTimeout: 5000,
    reporters: ['default', 'html'],
    outputFile: {
      html: '../../quality/reports/test-report-vitest/index.html',
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../quality/reports/coverage/vitest',
      reporter: ['text-summary', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/*.d.ts',
        'src/__tests__/**',
        'node_modules/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})