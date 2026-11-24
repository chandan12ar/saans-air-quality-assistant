import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

async function expectNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(summary, `axe violations on ${label}`).toEqual([]);
}

/** Loads the Delhi example on the synthetic smog day so the test needs no external service. */
async function buildSimulatedPlan(page: Page, peak = 300) {
  await page.goto("/");
  await page.getByRole("button", { name: "Delhi family, child with asthma" }).click();
  await page.getByLabel("Use a synthetic smog day instead of live data").check();
  await page.getByLabel(/Evening peak PM2\.5/).fill(String(peak));
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan for the day" })).toBeVisible();
}

test.describe("accessibility (axe, WCAG 2.2 AA + best practice)", () => {
  test("canary: the scanner really does flag a known violation", async ({ page }) => {
    await page.setContent('<html lang="en"><body><main><img src="x.png"><button></button></main></body></html>');
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations.map((v) => v.id)).toEqual(expect.arrayContaining(["image-alt", "button-name"]));
  });

  test("empty home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoViolations(page, "home");
  });

  test("results: forecast, plan and exposure ledger", async ({ page }) => {
    await buildSimulatedPlan(page);
    await expect(page.getByRole("heading", { name: "Before and after: your exposure ledger" })).toBeVisible();
    await expectNoViolations(page, "results");
  });

  test("hourly table and assumptions table expanded", async ({ page }) => {
    await buildSimulatedPlan(page);
    await page.getByText("Show hourly values").click();
    await page.getByText("How this was computed").click();
    await expectNoViolations(page, "expanded details");
  });

  test("AI trace dialog open", async ({ page }) => {
    await buildSimulatedPlan(page);
    await page.getByRole("button", { name: "Show AI trace" }).click();
    await expect(page.getByRole("dialog", { name: "AI trace" })).toBeVisible();
    await expectNoViolations(page, "trace dialog");
  });

  test("Hindi interface", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Language").selectOption("hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expectNoViolations(page, "hindi home");
  });

  test("error state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose a place first" })).toBeVisible();
    await expectNoViolations(page, "error state");
  });

  test("mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await buildSimulatedPlan(page);
    await expectNoViolations(page, "mobile results");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "no horizontal page scroll on a phone").toBeLessThanOrEqual(0);
  });
});
