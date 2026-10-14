import { expect, test, type Page } from '@playwright/test'

/** Wait until every step has a timing (no step is still running) and no status is shown. */
async function settled(page: Page) {
  await expect(page.locator('.canvas-wrap canvas').first()).toBeVisible()
  await expect(page.locator('.step-meta', { hasText: '…' })).toHaveCount(0, { timeout: 45_000 })
  await expect(page.locator('.viewer-status')).toHaveCount(0, { timeout: 45_000 })
}

test('loads the sample, runs the default pipeline and stays error-free', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await settled(page)
  // The default recipe narrows the image by 30% with seam carving; phones start
  // at a 1024px working size (1428 × 968 → 1024 × 694), laptops at 1600px.
  await expect(page.locator('.probe')).toContainText(isMobile ? '717 × 694' : '1,000 × 968', { timeout: 45_000 })
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

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch gestures run on the mobile project')

  test('tapping the image inspects a pixel', async ({ page }) => {
    await page.goto('./#r=' + Buffer.from(JSON.stringify({ version: 1, steps: [{ op: 'convolve', params: {} }] })).toString('base64url'))
    await settled(page)
    await page.getByRole('tab', { name: 'How it works' }).click()
    await expect(page.getByText('Tap the image to inspect a pixel.')).toBeVisible()
    const box = (await page.locator('.canvas-wrap').boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.kernel-inspector .sum').first()).toContainText('Σ')
  })

  test('pinching zooms the image', async ({ page }) => {
    await page.goto('./#r=' + Buffer.from(JSON.stringify({ version: 1, steps: [{ op: 'invert', params: {} }] })).toString('base64url'))
    await settled(page)
    const before = await page.locator('.zoom-value').textContent()
    const box = (await page.locator('.canvas-wrap').boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', d: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }],
      })
    await touch('touchStart', 20)
    for (const d of [40, 60, 80, 100]) await touch('touchMove', d)
    await touch('touchEnd', 0)
    await expect(page.locator('.zoom-value')).not.toHaveText(before!)
    const pct = (s: string | null) => Number(s?.replace('%', ''))
    expect(pct(await page.locator('.zoom-value').textContent())).toBeGreaterThan(pct(before))
  })
})
