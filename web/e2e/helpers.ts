import { expect, type Page } from '@playwright/test'

/** Wait until no step is still running and no status message is shown. */
export async function settled(page: Page) {
  await expect(page.locator('.canvas-wrap canvas').first()).toBeVisible()
  await expect(page.locator('.step-meta', { hasText: '…' })).toHaveCount(0, { timeout: 45_000 })
  await expect(page.locator('.viewer-status:not(.error)')).toHaveCount(0, { timeout: 45_000 })
}

/** On phones the pipeline lives in its own tab. */
export async function showPipeline(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('tab', { name: 'Pipeline' }).click()
}
