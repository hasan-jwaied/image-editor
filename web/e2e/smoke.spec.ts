import { expect, test } from '@playwright/test'
import { settled, showPipeline } from './helpers'

/** Phones start at a 1024px working size, laptops at 1600px (the 1428 × 968 sample fits as is). */
const sampleSize = (isMobile: boolean) => (isMobile ? '1,024 × 694' : '1,428 × 968')

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

test('operations toggle: click applies alone or removes, + stacks once', async ({ page, isMobile }) => {
  const library = async () => {
    if (isMobile) await page.getByRole('tab', { name: 'Add' }).click()
  }
  const stepNames = async () => {
    await showPipeline(page, isMobile)
    return page.locator('.steps .step-name').allTextContents()
  }
  const click = async (name: string) => {
    await library()
    await page.getByRole('button', { name, exact: true }).click()
    await settled(page)
  }
  await page.goto('./')
  await settled(page)

  await click('Apply Grayscale')
  expect(await stepNames()).toEqual(['Grayscale'])

  // Another operation replaces it, so each result stays readable on its own.
  await click('Apply Invert')
  expect(await stepNames()).toEqual(['Invert'])

  // "+" stacks an operation that isn't applied yet; applied ones show a check, not "+".
  await click('Add Sepia to the pipeline')
  expect(await stepNames()).toEqual(['Invert', 'Sepia'])
  await library()
  await expect(page.getByRole('button', { name: 'Add Invert to the pipeline' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add Grayscale to the pipeline' })).toBeVisible()

  // Clicking an applied operation removes just that one.
  await click('Remove Invert')
  expect(await stepNames()).toEqual(['Sepia'])
  await click('Remove Sepia')
  expect(await stepNames()).toEqual([])
  await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled()

  // Applying replaces a stack; undo brings it back.
  await click('Apply Invert')
  await click('Add Sepia to the pipeline')
  await click('Apply Brightness')
  expect(await stepNames()).toEqual(['Brightness'])
  await page.keyboard.press('Control+z')
  expect(await stepNames()).toEqual(['Invert', 'Sepia'])
})

test('a shared link never yields duplicate operations', async ({ page, isMobile }) => {
  const link = { version: 1, steps: [{ op: 'invert' }, { op: 'grayscale' }, { op: 'invert' }, { op: 'grayscale' }] }
  await page.goto('./#r=' + Buffer.from(JSON.stringify(link)).toString('base64url'))
  await settled(page)
  await showPipeline(page, isMobile)
  expect(await page.locator('.steps .step-name').allTextContents()).toEqual(['Invert', 'Grayscale'])
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
