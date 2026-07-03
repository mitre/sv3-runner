// E2E acceptance test (card sv3-runner-tu5.6): the test that justifies the project.
// Launch the extracted STIG Viewer 3 via Playwright's _electron with a .cklb path in
// argv (the exact mechanism run.mjs/main.js:166 use), then assert SV3 renders real
// rules with their status AND comment — proving a CKLB is accepted by real SV3.
import { test, expect, _electron } from '@playwright/test';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = join(__dirname, '..', '..');
const APP_DIR = join(PROJECT_DIR, 'sv3-app');
const FIXTURE = join(PROJECT_DIR, 'test', 'fixtures', 'sample.cklb');

// Rules the fixture carries (derived from a real SV3-produced RHEL 10 checklist):
const RULE_NAF = '311ff4e5-e6fc-46d3-8ee4-2aa75fea767c'; // V-282965 → not_a_finding + comment "hi"
const RULE_OPEN = 'c4194d86-be8a-4d13-87b7-fb9fd288dad1'; // V-281016 → open
const RULE_NA = '5b754c83-2a7c-410a-a083-76195294d477'; // V-281268 → not_applicable

// SV3 opens a splash window first, then the main window. Main loads dist/index.html;
// the splash loads dist/assets/splash/index.html — so the main window is the one whose
// URL contains index.html but not "splash".
async function mainWindow(app) {
  for (let i = 0; i < 60; i++) {
    for (const w of app.windows()) {
      const url = w.url();
      if (url.includes('index.html') && !url.includes('splash')) return w;
    }
    await app.waitForEvent('window', { timeout: 1000 }).catch(() => {});
  }
  throw new Error('SV3 main window (dist/index.html) never appeared');
}

test('SV3 opens a CKLB and renders rules with their real status + comment', async () => {
  test.skip(!existsSync(APP_DIR), 'sv3-app/ not found — run `npm run setup` first');

  const app = await _electron.launch({
    args: [APP_DIR, '--no-sandbox', FIXTURE],
    cwd: PROJECT_DIR,
  });

  try {
    const win = await mainWindow(app);

    // The not_a_finding rule row renders (proves the checklist loaded).
    const naf = win.locator(`button[data-id="${RULE_NAF}"]`);
    await expect(naf).toBeVisible({ timeout: 30_000 });
    // Its status button carries the exact status class from the CKLB.
    await expect(naf.locator('.rule_status button')).toHaveClass(/not_a_finding/);

    // A different rule shows a DIFFERENT status — proves SV3 reads the status field,
    // not a constant.
    await expect(win.locator(`button[data-id="${RULE_OPEN}"] .rule_status button`)).toHaveClass(
      /open/,
    );
    await expect(win.locator(`button[data-id="${RULE_NA}"] .rule_status button`)).toHaveClass(
      /not_applicable/,
    );

    // Select the not_a_finding rule → its comment text renders in the comment box.
    await naf.click();
    await expect(win.locator('.comments textarea')).toHaveValue('hi');

    // Evidence artifact.
    await win.screenshot({ path: join(PROJECT_DIR, 'test-results', 'cklb-loaded.png') });
  } finally {
    await app.close();
  }
});
