import { defineConfig } from '@playwright/test';

// E2E config for the Electron acceptance test (card sv3-runner-tu5.6).
// One worker: a single Electron (SV3) instance at a time; generous timeout for
// Electron boot + Angular render + checklist load.
export default defineConfig({
  testDir: './test/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: 'test-results',
});
