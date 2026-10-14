import { expect, test } from '@playwright/test'
import { settled } from './helpers'

// [name, width, height, touch]: from a 320px iPhone SE to a 1920px desktop.
const DEVICES: [string, number, number, boolean][] = [
  ['iPhone SE (1st gen)', 320, 568, true],
  ['older Android', 360, 740, true],
  ['iPhone 8', 375, 667, true],
  ['iPhone 15', 393, 852, true],
  ['iPhone 15 Pro Max', 430, 932, true],
  ['iPhone landscape', 852, 393, true],
  ['iPad mini', 744, 1133, true],
  ['iPad Air', 820, 1180, true],
  ['iPad landscape', 1180, 820, true],
  ['iPad Pro landscape', 1366, 1024, true],
  ['laptop', 1280, 800, false],
  ['desktop', 1920, 1080, false],
]

for (const [name, width, height, touch] of DEVICES) {
  test.describe(name, () => {
    test.use({ viewport: { width, height }, hasTouch: touch, isMobile: touch && width < 1000 })

    test('fits the screen with no horizontal overflow', async ({ page }) => {
      await page.goto('./')
      await settled(page)
      const overflowing = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        return [...document.querySelectorAll('body *')]
          .filter((el) => !el.closest('.table-wrap, .code-block, .canvas-wrap, .chart-plot, details:not([open])'))
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return r.width > 0 && (r.right > vw + 1 || r.left < -1)
          })
          .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`)
      })
      expect(overflowing).toEqual([])
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    })
  })
}
