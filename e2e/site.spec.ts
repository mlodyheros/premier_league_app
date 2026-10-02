import { expect, test, type Page } from '@playwright/test';

const PAGES = ['', 'guess', 'road100', 'higher-lower', 'budget', 'transfer', 'beat-model', 'price-tag', 'market', 'league', 'stats', 'how'];

test.beforeEach(async ({ page }) => {
  // Skip the first-visit screens (they have their own test), in English.
  await page.addInitScript(() => {
    localStorage.setItem('plg:onboarded', 'true');
    localStorage.setItem('plg:lang', '"en"');
  });
});

/** Collects console errors and failed requests while a test runs. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  return errors;
}

async function open(page: Page, path: string) {
  await page.goto(`./#/${path}`);
  await expect(page.locator('main h1').first()).toBeVisible();
}

for (const path of PAGES) {
  test(`#/${path} renders without errors or sideways scrolling`, async ({ page }) => {
    const errors = watchErrors(page);
    await open(page, path);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('first visit shows the onboarding, once', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('plg:onboarded'));
  await page.goto('./');
  const dialog = page.locator('dialog.onboard');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Next' }).click();
  await dialog.getByRole('button', { name: "Let's play" }).click();
  await expect(dialog).toBeHidden();
});

test.describe('on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'phone layout');

  /** The answer buttons are on screen and above the bottom bar, without scrolling. */
  async function inThumbReach(page: Page, selector: string) {
    // Let the page's entrance animation (a 10px slide) finish first.
    await page.waitForTimeout(500);
    const box = await page.locator(selector).first().boundingBox();
    const nav = await page.locator('.bottom-nav').boundingBox();
    expect(box && nav).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y + 1);
    expect(box!.y).toBeGreaterThan(0);
  }

  test('Higher or Lower answers are in thumb reach', async ({ page }) => {
    await open(page, 'higher-lower');
    await inThumbReach(page, '.hl__buttons');
  });

  test('Beat the Model answers are in thumb reach', async ({ page }) => {
    await open(page, 'beat-model');
    await inThumbReach(page, '.bm__buttons');
  });

  test("Budget XI's picker opens as a sheet on screen", async ({ page }) => {
    await open(page, 'budget');
    await page.locator('.slot').first().click();
    const sheet = page.locator('.picker--open');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('.prow').first()).toBeInViewport();
    await page.keyboard.press('Escape');
    await expect(page.locator('.picker--open')).toHaveCount(0);
  });
});

test('Guess the Player suggests names, also for a typo', async ({ page }) => {
  await open(page, 'guess');
  const input = page.getByRole('combobox');
  await input.fill('Saka');
  await expect(page.getByRole('option', { name: /Bukayo Saka/ })).toBeVisible();
  await input.fill('Halland');
  await expect(page.getByRole('option', { name: /Erling Haaland/ })).toBeVisible();
});

test('Transfer Window: a deal moves the money and the forecast', async ({ page }) => {
  await open(page, 'transfer');
  await page.locator('.tw-clubs button', { hasText: 'Everton' }).click();
  const money = page.locator('.tw-money');
  const before = await money.textContent();
  await page.locator('.tw-list .btn', { hasText: 'Sell' }).first().click();
  await expect(money).not.toHaveText(before!);
  await expect(page.locator('.tw-deal--out')).toHaveCount(1);
  await page.locator('.tw-play .btn').click();
  await expect(page.locator('.season__pts')).toBeVisible();
});

test('the friends league adds a friend from a link', async ({ page }) => {
  const card = { v: 1, n: 'Tester', d: '2026-01-01', g: '3/8', b: null, p: null, r: 90, h: 5, t: 1 };
  const code = Buffer.from(JSON.stringify(card)).toString('base64url');
  // Through the share page, as a shared link arrives: it forwards to #/league with the code.
  await page.goto(`./g/league/?add=${code}`);
  await expect(page.locator('.league-table')).toContainText('Tester');
  await expect(page).toHaveURL(/#\/league$/);
});

test('Market of the week lists risers and fallers', async ({ page }) => {
  await open(page, 'market');
  await expect(page.locator('.moves').first().locator('.move').first()).toBeVisible();
});

test('every share page forwards to its game and has its own preview', async ({ page, request }) => {
  for (const path of ['guess', 'transfer', 'market']) {
    const html = await (await request.get(`./g/${path}/`)).text();
    expect(html).toContain(`og/${path}.png`);
    expect((await request.get(`./og/${path}.png`)).status()).toBe(200);
  }
  await page.goto('./g/transfer/');
  await expect(page).toHaveURL(/#\/transfer$/);
  await expect(page.locator('main h1').first()).toBeVisible();
});

test('Road to 100: draw club and position at once, then start over', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'plg:road:state',
      JSON.stringify({ formation: '433', picks: {}, respins: 3, spin: null, season: null, difficulty: 'realistic', draft: 'position' }),
    );
  });
  await open(page, 'road100');
  await page.getByRole('button', { name: 'Draw club and position' }).click();
  await page.getByRole('button', { name: 'Stop' }).first().click();
  // The first draw of both is free: all three re-spins are left.
  await expect(page.locator('.controls__info')).toContainText('3');
  await page.locator('.picker__list .prow').first().click();
  await expect(page.locator('.controls__info')).toContainText('1/11');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.locator('.controls__info')).toContainText('0/11');
});
