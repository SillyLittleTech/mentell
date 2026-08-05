import { test } from "@playwright/test";

const PAGES = [
  { name: "home", path: "/" },
  { name: "projector", path: "/week" },
  { name: "notes", path: "/notes" },
  { name: "shop", path: "/shop" },
  { name: "lab", path: "/character-lab" },
  { name: "settings", path: "/settings" },
  { name: "feedback", path: "/feedback" },
  { name: "privacy", path: "/privacy" }
];

test.describe("App Screenshots", () => {
  test.setTimeout(120000); // Allow 2 mins per browser test since it visits 8 pages twice each

  test("capture major app states", async ({ page }, testInfo) => {
    // Project name will be either 'desktop' or 'mobile' from the config
    const viewPortName = testInfo.project.name;

    for (const p of PAGES) {
      // Light Mode
      await page.goto(p.path);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000); // Allow animations

      // Attempt to close any introductory modals if they pop up (specifically on home)
      if (p.name === "home") {
        const startButton = page.getByRole("button", { name: /get started|continue/i });
        if (await startButton.isVisible()) {
          await startButton.click();
          await page.waitForTimeout(500);
        }
      }

      await page.evaluate(() => {
        localStorage.setItem("mentell.theme", "light");
      });
      await page.emulateMedia({ colorScheme: "light" });
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `e2e-screenshots/${viewPortName}-${p.name}-light.png`,
        fullPage: true,
      });

      // Dark Mode
      await page.evaluate(() => {
        localStorage.setItem("mentell.theme", "dark");
      });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: `e2e-screenshots/${viewPortName}-${p.name}-dark.png`,
        fullPage: true,
      });
    }
  });
});
