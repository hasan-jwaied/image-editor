import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { settled } from './helpers'

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url).pathname

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await settled(page)
})

test('every operation runs on its own and shows its explanation', async ({ page }) => {
  const names = await page
    .locator('.library .op-btn')
    .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))
  expect(names).toHaveLength(19)
  for (const name of names) {
    await page.getByRole('button', { name, exact: true }).click()
    await settled(page)
    await expect(page.locator('.viewer-status.error'), name).toHaveCount(0)
    await expect(page.locator('.steps > li'), name).toHaveCount(1)
    await expect(page.locator('.explain .explain-text'), name).toBeVisible()
  }
})

test('uploads never run anything, and a broken file gets a clear message', async ({ page }) => {
  for (const file of ['photo.jpg', 'transparent.png']) {
    await page.locator('input[type=file]').setInputFiles(fixture(file))
    await settled(page)
    await expect(page.locator('.viewer-status.error'), file).toHaveCount(0)
    await expect(page.locator('.steps > li'), file).toHaveCount(0)
  }
  await page.locator('input[type=file]').setInputFiles(fixture('not-an-image.png'))
  await expect(page.locator('.viewer-status.error')).toContainText('could not be opened')
  await page.getByRole('button', { name: 'Broadway Tower' }).click()
  await settled(page)
  await expect(page.locator('.viewer-status.error')).toHaveCount(0)
})

test('split view compares the original with the whole pipeline', async ({ page }) => {
  const pixels = (canvas: string) =>
    page.locator(canvas).evaluate((c: HTMLCanvasElement) => {
      const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
      return Array.from(data.filter((_, i) => i % 97 === 0)).join()
    })
  await page.getByRole('button', { name: 'Apply Invert', exact: true }).click()
  await page.getByRole('button', { name: 'Add Sepia to the pipeline' }).click()
  await settled(page)
  const output = await pixels('.canvas-wrap canvas[role=img]')

  await page.locator('.hold-btn').dispatchEvent('pointerdown')
  const original = await pixels('.canvas-wrap canvas[role=img]')
  await page.locator('.hold-btn').dispatchEvent('pointerup')
  expect(original).not.toBe(output)

  await page.getByRole('radio', { name: 'Split' }).click()
  await expect(page.locator('.split-tag', { hasText: 'Original' })).toBeVisible()
  expect(await pixels('.canvas-wrap canvas[aria-hidden=true]')).toBe(original)
  expect(await pixels('.canvas-wrap canvas[role=img]')).toBe(output)
})

test('viewer controls, settings and shortcuts', async ({ page }) => {
  await page.getByRole('button', { name: 'Apply Invert', exact: true }).click()
  await settled(page)

  await page.locator('.working-size select').selectOption('1024')
  await settled(page)
  await expect(page.locator('.probe')).toContainText('1,024')

  await page.getByRole('radio', { name: 'Split' }).click()
  await expect(page.locator('.split-handle')).toHaveCount(1)
  await page.getByRole('radio', { name: 'Result' }).click()

  await page.locator('.hold-btn').dispatchEvent('pointerdown')
  await expect(page.locator('.split-tag', { hasText: 'Original' })).toBeVisible()
  await page.locator('.hold-btn').dispatchEvent('pointerup')

  const zoom = await page.locator('.zoom-value').textContent()
  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect(page.locator('.zoom-value')).not.toHaveText(zoom!)
  await page.getByRole('button', { name: 'Fit' }).click()

  // Switching language translates in place: nothing is reprocessed.
  const timing = await page.locator('.step-meta').first().textContent()
  await page.getByLabel('Language').selectOption('he')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.viewer-status')).toHaveCount(0)
  await expect(page.locator('.step-meta').first()).toHaveText(timing!)
  await page.getByLabel('שפה').selectOption('en')

  await page.getByRole('button', { name: 'Dark theme' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: 'Light theme' }).click()

  await page.locator('.step-title').first().focus()
  await page.keyboard.press('Delete')
  await expect(page.locator('.steps > li')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(page.locator('.steps > li')).toHaveCount(1)
  await settled(page)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^pixel-lab-.*\.png$/)
  const png = await readFile((await download.path())!)
  expect([...png.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG')
})
