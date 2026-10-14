import { expect, test, type Page } from '@playwright/test'

/** Wait until every step has a timing (no step is still running) and no status is shown. */
async function settled(page: Page) {
  await expect(page.locator('.canvas-wrap canvas').first()).toBeVisible()
  await expect(page.locator('.step-meta', { hasText: '…' })).toHaveCount(0, { timeout: 45_000 })
  await expect(page.locator('.viewer-status')).toHaveCount(0, { timeout: 45_000 })
}

/** Phones start at a 1024px working size, laptops at 1600px (the 1428 × 968 sample fits as is). */
const sampleSize = (isMobile: boolean) => (isMobile ? '1,024 × 694' : '1,428 × 968')

async function showPipeline(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('tab', { name: 'Pipeline' }).click()
}

test('nothing runs until the visitor chooses an operation', async ({ page, isMobile }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await settled(page)
  await showPipeline(page, isMobile)
  await expect(page.locator('.steps > li')).toHaveCount(0)
  await expect(page.locator('.probe')).toContainText(sampleSize(isMobile))
  // With no steps there is nothing to compare or export.
  await expect(page.getByRole('radio', { name: 'Split' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled()

  // Switching images and reloading leave the image untouched too.
  await page.getByRole('button', { name: 'Apollo 11' }).click()
  await settled(page)
  await expect(page.locator('.steps > li')).toHaveCount(0)
  await page.reload()
  await settled(page)
  await showPipeline(page, isMobile)
  await expect(page.locator('.steps > li')).toHaveCount(0)
  expect(new URL(page.url()).hash).toBe('')
  expect(errors).toEqual([])
})

test('recipes, undo, and a shared link that applies once', async ({ page, context, isMobile }) => {
  await page.goto('./')
  await settled(page)
  await page.getByRole('button', { name: 'Newsprint' }).click()
  await settled(page)
  await showPipeline(page, isMobile)
  await expect(page.locator('.steps > li')).toHaveCount(3)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.steps > li')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.steps > li')).toHaveCount(3)
  // The address bar never tracks the pipeline; only "Copy link" makes a link.
  expect(new URL(page.url()).hash).toBe('')

  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy link' }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain('#r=')

  const shared = await context.newPage()
  await shared.goto(link)
  await settled(shared)
  await showPipeline(shared, isMobile)
  await expect(shared.locator('.steps > li')).toHaveCount(3)
  expect(new URL(shared.url()).hash).toBe('')
  await shared.reload()
  await settled(shared)
  await showPipeline(shared, isMobile)
  await expect(shared.locator('.steps > li')).toHaveCount(0)
})

test('clicking an operation applies it alone; + stacks it', async ({ page, isMobile }) => {
  const library = async () => {
    if (isMobile) await page.getByRole('tab', { name: 'Add' }).click()
  }
  const stepNames = async () => {
    await showPipeline(page, isMobile)
    return page.locator('.steps .step-name').allTextContents()
  }
  await page.goto('./')
  await settled(page)

  await library()
  await page.getByRole('button', { name: 'Apply Grayscale' }).click()
  await settled(page)
  expect(await stepNames()).toEqual(['Grayscale'])

  // A second click on another operation replaces it, so each result stays readable.
  await library()
  await page.getByRole('button', { name: 'Apply Invert' }).click()
  await settled(page)
  expect(await stepNames()).toEqual(['Invert'])

  // "+" stacks on top of what is there.
  await library()
  await page.getByRole('button', { name: 'Add Sepia to the pipeline' }).click()
  await settled(page)
  expect(await stepNames()).toEqual(['Invert', 'Sepia'])
  await library()
  await expect(page.getByRole('button', { name: 'Invert, in the pipeline' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Apply Grayscale' })).toBeVisible()

  // Applying replaces the stack; undo brings it back.
  await page.getByRole('button', { name: 'Apply Brightness' }).click()
  await settled(page)
  expect(await stepNames()).toEqual(['Brightness'])
  await page.keyboard.press('Control+z')
  expect(await stepNames()).toEqual(['Invert', 'Sepia'])
  await page.keyboard.press('Control+Shift+z')

  // Re-applying the operation that is already alone keeps its settings.
  if (isMobile) await page.getByRole('tab', { name: 'How it works' }).click()
  const slider = page.getByRole('slider', { name: 'Amount' })
  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(slider).toHaveValue('31')
  await library()
  await page.getByRole('button', { name: 'Brightness, in the pipeline' }).click()
  if (isMobile) await page.getByRole('tab', { name: 'How it works' }).click()
  await expect(page.getByRole('slider', { name: 'Amount' })).toHaveValue('31')
})

test('a section link such as #how lands on that section, below the nav bar', async ({ page }) => {
  await page.goto('./#how')
  await expect
    .poll(() => page.evaluate(() => Math.round(document.getElementById('how')!.getBoundingClientRect().top)))
    .toBeGreaterThanOrEqual(48)
  expect(new URL(page.url()).hash).toBe('#how')
  await expect(page.locator('.steps > li')).toHaveCount(0)
})

test('panels hand the scroll on to the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'wheel scrolling is a laptop/desktop gesture')
  await page.goto('./')
  await settled(page)
  await page.evaluate(() =>
    window.scrollTo({ top: document.getElementById('lab')!.offsetTop - 48, behavior: 'instant' }),
  )
  for (const panel of ['.library-panel', '.inspector']) {
    // Scroll the panel to its end first; the next wheel gesture must reach the page.
    await page.locator(panel).evaluate((el) => (el.scrollTop = el.scrollHeight))
    const before = await page.evaluate(() => window.scrollY)
    await page.locator(panel).hover()
    await page.mouse.wheel(0, 400)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
    await page.evaluate(() =>
      window.scrollTo({ top: document.getElementById('lab')!.offsetTop - 48, behavior: 'instant' }),
    )
  }
})

test('explainers respond to the image', async ({ page, isMobile }) => {
  test.skip(isMobile, 'hover inspection is a pointer feature')
  await page.goto(
    './#r=' +
      Buffer.from(JSON.stringify({ version: 1, steps: [{ op: 'convolve', params: {} }] })).toString('base64url'),
  )
  await settled(page)
  // hover() scrolls the image into view and moves the pointer over its centre.
  await page.locator('.canvas-wrap').hover()
  await expect(page.locator('.kernel-inspector .sum').first()).toContainText('Σ')
})

test('switches to Hebrew with a right-to-left layout', async ({ page }) => {
  await page.goto('./')
  await page.getByLabel('Language').selectOption('he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('h1')).toContainText('מאפס')
})

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch gestures run on the mobile project')

  test('tapping the image inspects a pixel', async ({ page }) => {
    await page.goto(
      './#r=' +
        Buffer.from(JSON.stringify({ version: 1, steps: [{ op: 'convolve', params: {} }] })).toString('base64url'),
    )
    await settled(page)
    await page.getByRole('tab', { name: 'How it works' }).click()
    await expect(page.getByText('Tap the image to inspect a pixel.')).toBeVisible()
    const box = (await page.locator('.canvas-wrap').boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.kernel-inspector .sum').first()).toContainText('Σ')
  })

  test('pinching zooms the image', async ({ page }) => {
    await page.goto(
      './#r=' +
        Buffer.from(JSON.stringify({ version: 1, steps: [{ op: 'invert', params: {} }] })).toString('base64url'),
    )
    await settled(page)
    const before = await page.locator('.zoom-value').textContent()
    const box = (await page.locator('.canvas-wrap').boundingBox())!
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const cdp = await page.context().newCDPSession(page)
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', d: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints:
          type === 'touchEnd'
            ? []
            : [
                { x: cx - d, y: cy, id: 1 },
                { x: cx + d, y: cy, id: 2 },
              ],
      })
    await touch('touchStart', 20)
    for (const d of [40, 60, 80, 100]) await touch('touchMove', d)
    await touch('touchEnd', 0)
    await expect(page.locator('.zoom-value')).not.toHaveText(before!)
    const pct = (s: string | null) => Number(s?.replace('%', ''))
    expect(pct(await page.locator('.zoom-value').textContent())).toBeGreaterThan(pct(before))
  })
})
