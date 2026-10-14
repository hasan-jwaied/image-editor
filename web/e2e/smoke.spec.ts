import { expect, test, type Page } from '@playwright/test'

/** Wait until every step has a timing (no step is still running) and no status is shown. */
async function settled(page: Page) {
  await expect(page.locator('.canvas-wrap canvas').first()).toBeVisible()
  await expect(page.locator('.step-meta', { hasText: '…' })).toHaveCount(0, { timeout: 45_000 })
  await expect(page.locator('.viewer-status')).toHaveCount(0, { timeout: 45_000 })
}

test('loads the sample, runs the default pipeline and stays error-free', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await settled(page)
  // The default recipe narrows the image by 30% with seam carving.
  await expect(page.locator('.probe')).toContainText('1,000 × 968', { timeout: 45_000 })
  expect(errors).toEqual([])
})

test('recipes, undo and the share link round-trip', async ({ page, isMobile }) => {
  await page.goto('./')
  await settled(page)
  await page.getByRole('button', { name: 'Newsprint' }).click()
  await settled(page)
  if (isMobile) await page.getByRole('tab', { name: 'Pipeline' }).click()
  await expect(page.locator('.steps > li')).toHaveCount(3)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.steps > li')).toHaveCount(1)
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.steps > li')).toHaveCount(3)
  // The URL hash carries the recipe; reloading restores it.
  expect(page.url()).toContain('#r=')
  await page.reload()
  await settled(page)
  if (isMobile) await page.getByRole('tab', { name: 'Pipeline' }).click()
  await expect(page.locator('.steps > li')).toHaveCount(3)
})

test('explainers respond to the image', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover inspection is a pointer feature')
  await page.goto('./#r=' + Buffer.from(JSON.stringify({ version: 1, steps: [{ op: 'convolve', params: {} }] })).toString('base64url'))
  await settled(page)
  // hover() scrolls the image into view and moves the pointer over its centre.
  await page.locator('.canvas-wrap').hover()
  await expect(page.locator('.kernel-inspector .sum').first()).toContainText('Σ')
})

test('switches to Arabic with a right-to-left layout', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('Language').selectOption('ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('h1')).toContainText('من الصفر')
})
