import { expect, test } from "@playwright/test";
import {
    clearSelection,
    dragSelect,
    expectClosed,
    expectOpen,
    openScene,
} from "./helpers";

test.describe("static text", () => {
    test("opens on read-only content and keeps it open from an item", async ({
        page,
    }) => {
        await openScene(page, "static");
        await dragSelect(page, page.getByTestId("static-p"));

        await expectOpen(page, "static-status");
        await expect(page.getByTestId("static-popup")).toBeVisible();

        await page.getByTestId("static-stay").click();
        await expect(page.getByTestId("static-popup")).toBeVisible();
        await expect(page.getByTestId("static-status")).toHaveAttribute(
            "data-open",
            "true",
        );

        await page.getByTestId("static-close").click();
        await expectClosed(page, "static-status", "close-press");
        await expect(page.getByTestId("static-popup")).toHaveCount(0);
    });

    test("closes when the text selection is cleared", async ({ page }) => {
        await openScene(page, "static");
        await dragSelect(page, page.getByTestId("static-p"));
        await expectOpen(page, "static-status");

        await clearSelection(page);

        await expectClosed(page, "static-status", "selection-clear");
    });
});
