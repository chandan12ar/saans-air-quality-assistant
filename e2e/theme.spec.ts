import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const BANDS = [20, 70, 110, 200, 450] as const;
const WCAG = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"];

async function plan(page: Page, peak: number, preset = "Delhi family, child with asthma") {
  await page.goto("/");
  await page.getByRole("button", { name: preset }).click();
  await page.getByLabel("Use a synthetic smog day instead of live data").check();
  await page.getByLabel(/Evening peak PM2\.5/).fill(String(peak));
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan for the day" })).toBeVisible();
}

/** The haze the sky is currently drawing, from the WebGL canvas or the CSS fallback. */
async function drawnHaze(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>(".sky-canvas");
    if (canvas?.dataset.haze) return Number(canvas.dataset.haze);
    const fallback = document.querySelector<HTMLElement>(".sky-fallback");
    return Number(fallback?.style.getPropertyValue("--haze") || 0);
  });
}

const hazeOf = (value: string | null) => Number((value ?? "0,0,0").split(",")[1]);

test.describe("live sky", () => {
  test("starts at a clear sunrise and is hidden from assistive technology", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app")).toHaveAttribute("data-air", "idle");
    await expect(page.locator(".sky")).toHaveAttribute("aria-hidden", "true");
    await expect.poll(() => drawnHaze(page)).toBeLessThan(0.15);
  });

  test("scrolling the story turns the sky from clean to severe smog and back", async ({ page }) => {
    await page.goto("/");
    await page.locator("#story-severe").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(() => drawnHaze(page), { timeout: 10_000 }).toBeGreaterThan(0.8);
    await page.locator("#story-clean").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(() => drawnHaze(page), { timeout: 10_000 }).toBeLessThan(0.15);
  });

  test("the simulator slider repaints the sky behind the form", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Use a synthetic smog day instead of live data").check();
    const slider = page.getByLabel(/Evening peak PM2\.5/);
    await slider.fill("20");
    const low = hazeOf(await page.locator("#household").getAttribute("data-sky"));
    await slider.fill("600");
    const high = hazeOf(await page.locator("#household").getAttribute("data-sky"));
    expect(high).toBeGreaterThan(low);
  });

  test("a worse day gives the results a smoggier sky than a clean day", async ({ page }) => {
    await plan(page, 20);
    const clean = hazeOf(await page.locator("#plan").getAttribute("data-sky"));
    await page.getByLabel(/Evening peak PM2\.5/).fill("450");
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page.locator(".app")).toHaveAttribute("data-air", /very_poor|severe/);
    const smoggy = hazeOf(await page.locator("#plan").getAttribute("data-sky"));
    expect(smoggy).toBeGreaterThan(clean);
  });

  for (const peak of BANDS) {
    test(`a ${peak} µg/m³ day is themed by its band and passes axe`, async ({ page }) => {
      await plan(page, peak);
      const themed = await page.locator(".app").getAttribute("data-air");
      expect(["good", "satisfactory", "moderate", "poor", "very_poor", "severe"]).toContain(themed);
      if (peak === 20) expect(themed).toBe("good");
      if (peak === 450) expect(["very_poor", "severe"]).toContain(themed);
      await page.waitForFunction(() =>
        document.getAnimations().every((a) => a.effect?.getTiming().iterations === Infinity || a.playState !== "running"),
      );
      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 2).join(" | ")}`)).toEqual([]);
    });
  }

  test("with reduced motion, decorative animation stops", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto("/");
    expect(await page.locator(".breath").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    expect(await page.locator(".scroll-hint svg").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
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

test.describe("simplified form", () => {
  test("choosing a large purifier makes the plan use it instead of a DIY filter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Delhi family, child with asthma" }).click();
    await page.getByRole("radio", { name: "Large (living room)" }).check();
    await page.getByLabel("Use a synthetic smog day instead of live data").check();
    await page.getByRole("button", { name: "Build my plan" }).click();
    await expect(page.getByLabel("Run your air purifier at home")).toBeVisible();
    await expect(page.getByLabel("DIY box-fan filter at home")).toHaveCount(0);
  });

  test("every choice is a labelled radio or switch reachable by keyboard", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("radio", { name: "Someone over 60" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "A child" })).toBeChecked();
    await page.getByRole("switch", { name: "Someone has asthma or a breathing condition" }).focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("switch", { name: "Someone has asthma or a breathing condition" })).toBeChecked();
  });
});

test.describe("share and report", () => {
  test("WhatsApp share carries the plan with engine figures and no personal notes", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Delhi family, child with asthma" }).click();
    await page.locator(".more summary").click();
    await page.getByLabel("Anything else we should know? (optional)").fill("private note about my son");
    await page.getByLabel("Use a synthetic smog day instead of live data").check();
    await page.getByRole("button", { name: "Build my plan" }).click();
    const href = await page.getByRole("link", { name: "Share on WhatsApp" }).getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    const text = decodeURIComponent(href!.replace("https://wa.me/?text=", ""));
    expect(text).toContain("New Delhi");
    expect(text).toMatch(/cuts the PM2\.5 we breathe by an estimated \d+% to \d+%/);
    expect(text).not.toContain("private note");
    await expect(page.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute("rel", /noopener/);
  });

  test("the printable report hides the sky, story and form and keeps the results", async ({ page }) => {
    await plan(page, 300);
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".sky")).toBeHidden();
    await expect(page.locator(".story")).toBeHidden();
    await expect(page.locator(".form-card")).toBeHidden();
    await expect(page.getByRole("heading", { name: "Your plan for the day" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Before and after" })).toBeVisible();
    await expect(page.getByText(/Saans air plan: New Delhi/)).toBeVisible();
  });
});
