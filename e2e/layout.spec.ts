import { expect, test, type Page } from "@playwright/test";

async function results(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Delhi family, child with asthma" }).click();
  await page.getByLabel("Use a synthetic smog day instead of live data").check();
  await page.getByRole("button", { name: "Build my plan" }).click();
  await expect(page.getByRole("heading", { name: "Your plan for the day" })).toBeVisible();
  // Open the widest content so it is part of the check.
  await page.getByText("How this was computed").click();
  await page.getByText("Show hourly values as a table").click();
}

test.describe("layout", () => {
  for (const width of [1920, 1440, 1280, 1024, 820, 390]) {
    test(`no result cards overlap and none leave the page at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await results(page);
      const boxes = await page.locator(".results .card").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.querySelector("h3")?.textContent ?? "?", l: r.left, r: r.right, t: r.top + scrollY, b: r.bottom + scrollY };
        }),
      );
      const vw = await page.evaluate(() => document.documentElement.clientWidth);
      for (const a of boxes) expect(a.r, `${a.id} leaves the page`).toBeLessThanOrEqual(vw + 0.5);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlap = Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
          expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
        }
      }
    });
  }

  test("the story is one pinned scene whose number climbs as you scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".meter-num")).toHaveCount(1);
    const read = () => page.locator(".meter-num span").first().textContent();
    await page.locator("#story-clean").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(read).toBe("15");
    await page.locator("#story-standard").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(async () => Number(await read())).toBeGreaterThan(30);
    await page.locator("#story-severe").evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect.poll(read).toBe("250+");
    await expect(page.locator(".meter-label")).toHaveText("Severe");
  });
});
