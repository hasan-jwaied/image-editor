import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const scheme of ['light', 'dark'] as const) {
  test(`no automatically detectable accessibility violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/')
    await expect(page.locator('.step-meta', { hasText: '…' })).toHaveCount(0, { timeout: 45_000 })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(' | ')}`)
    expect(summary).toEqual([])
  })
}
