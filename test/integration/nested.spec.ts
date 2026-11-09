import { expect, test } from "@playwright/test";
import {
    expectOpen,
    openScene,
    selectAcross,
    selectText,
} from "./helpers";

test.describe("nested areas", () => {
    test("opens only the innermost toolbar", async ({ page }) => {
        await openScene(page, "nested");
        await selectText(page, "[data-testid=inner-p]", 0, 5);

        await expectOpen(page, "inner-status");
        await expect(page.getByTestId("inner-popup")).toBeVisible();
        await expect(page.getByTestId("outer-status")).toHaveAttribute(
            "data-open",
            "false",
        );
        await expect(page.getByTestId("outer-popup")).toHaveCount(0);
        await expect
            .poll(() => page.evaluate(() => window.__selectionEvents))
            .toEqual([
                { label: "Inner actions", open: true, reason: "auto-open" },
            ]);
    });

    test("opens no toolbar when the selection crosses the inner boundary", async ({
        page,
    }) => {
        await openScene(page, "nested");
        await selectAcross(page, "[data-testid=outer-p]", "[data-testid=inner-p]");
        await page.waitForTimeout(250);

        await expect(page.getByTestId("inner-status")).toHaveAttribute(
            "data-open",
            "false",
        );
        await expect(page.getByTestId("outer-status")).toHaveAttribute(
            "data-open",
            "false",
        );
        await expect(page.getByTestId("inner-popup")).toHaveCount(0);
        await expect(page.getByTestId("outer-popup")).toHaveCount(0);
        expect(await page.evaluate(() => window.__selectionEvents)).toEqual([]);
    });

    test("opens the inner toolbar when the selection stays inside it", async ({
        page,
    }) => {
        await openScene(page, "nested");
        await selectText(page, "[data-testid=inner-p]", 6, 10);
        await expectOpen(page, "inner-status");

        await selectText(page, "[data-testid=inner-p]", 12, 16);
        await expect(page.getByTestId("inner-status")).toHaveAttribute(
            "data-open",
            "true",
        );
        await expect(page.getByTestId("outer-status")).toHaveAttribute(
            "data-open",
            "false",
        );
    });
});
