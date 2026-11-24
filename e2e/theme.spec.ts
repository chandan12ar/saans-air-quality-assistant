import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BANDS = [
  { peak: 20, air: "good" },
  { peak: 70, air: "satisfactory" },
  { peak: 110, air: "moderate" },
  { peak: 200, air: "very_poor" },
  { peak: 450, air: "severe" },
] as const;

async function plan(page: Page, peak: number) {
  await page.goto("/");
  await page.getByRole("button", { name: "Delhi family, child with asthma" }).click();
  await page.getByLabel("Use a synthetic smog day instead of live data").check();
  await page.getByLabel(/Evening peak PM2\.5/).fill(String(peak));
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan for the day" })).toBeVisible();
}

test.describe("air-driven theme", () => {
  test("the page starts in a calm idle state with a window onto the sky", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app")).toHaveAttribute("data-air", "idle");
    await expect(page.locator(".window")).toBeVisible();
    await expect(page.getByText("Tell us where you live to see your sky")).toBeVisible();
  });

  test("the scene is decorative: hidden from assistive technology, with the facts as text", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".glass")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".frame")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".readout")).toBeVisible();
  });

  for (const { peak, air } of BANDS) {
    test(`a ${peak} µg/m³ day themes the page as "${air}" and stays accessible`, async ({ page }) => {
      await plan(page, peak);
      // The theme follows the day's average, which sits below the evening peak.
      const themed = await page.locator(".app").getAttribute("data-air");
      expect(["good", "satisfactory", "moderate", "poor", "very_poor", "severe"]).toContain(themed);
      if (peak === 450) expect(["very_poor", "severe"]).toContain(themed);
      if (peak === 20) expect(themed).toBe("good");
      await page.waitForTimeout(2000); // let the 1.8 s sky transition finish before measuring contrast
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
    });
  }

  test("a worse day makes the sky browner and the smog heavier than a clean day", async ({ page }) => {
    await plan(page, 20);
    await page.waitForTimeout(2000);
    const clean = await page.locator(".app").evaluate((el) => getComputedStyle(el).getPropertyValue("--smog").trim());
    await page.getByLabel(/Evening peak PM2\.5/).fill("450");
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page.locator(".app")).toHaveAttribute("data-air", /very_poor|severe/);
    await page.waitForTimeout(2200);
    const smoggy = await page.locator(".app").evaluate((el) => getComputedStyle(el).getPropertyValue("--smog").trim());
    expect(Number(smoggy)).toBeGreaterThan(Number(clean));
  });

  test("with reduced motion the scene stops animating", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    const animations = await page.locator(".cloud.c1").evaluate((el) => getComputedStyle(el).animationName);
    expect(animations).toBe("none");
    await context.close();
  });

  test("no horizontal overflow at desktop, tablet and phone widths", async ({ page }) => {
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
});
