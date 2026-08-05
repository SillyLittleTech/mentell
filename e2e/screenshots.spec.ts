import { test, expect } from "@playwright/test";

test.describe("App Screenshots", () => {
  test("capture major app states", async ({ page }) => {
    // 1. Home / Dashboard
    await page.goto("/");

    // Wait for the app to load and stabilize
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000); // Wait an extra second for animations

    // Attempt to close any introductory modals if they pop up
    const startButton = page.getByRole("button", {
      name: /get started|continue/i,
    });
    if (await startButton.isVisible()) {
      await startButton.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({
      path: "e2e-screenshots/home-light.png",
      fullPage: true,
    });

    // Toggle dark mode
    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "e2e-screenshots/home-dark.png",
      fullPage: true,
    });

    // 2. Settings Page
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "e2e-screenshots/settings-dark.png",
      fullPage: true,
    });

    await page.emulateMedia({ colorScheme: "light" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "e2e-screenshots/settings-light.png",
      fullPage: true,
    });

    // 3. Shop Page
    await page.goto("/shop");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "e2e-screenshots/shop-light.png",
      fullPage: true,
    });

    await page.emulateMedia({ colorScheme: "dark" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: "e2e-screenshots/shop-dark.png",
      fullPage: true,
    });
  });
});
