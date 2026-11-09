import { expect, test } from "@playwright/test";
import {
    expectClosed,
    expectOpen,
    getSelectionLines,
    openScene,
    selectContents,
    selectText,
} from "./helpers";

test.use({ viewport: { width: 900, height: 700 } });

test.describe("geometry", () => {
    test("places the toolbar above a selection with room", async ({ page }) => {
        await openScene(page, "geometry", {
            top: 300,
            left: 240,
            width: 420,
        });
        await selectText(page, "[data-testid=geometry-p]", 0, 10);
        await expectOpen(page, "geometry-status");

        const lines = await getSelectionLines(page);
        const popup = page.getByTestId("geometry-popup");
        const box = await popup.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(
            lines[0]!.top - 8 + 0.5,
        );
    });

    test("places the toolbar below a selection near the top", async ({
        page,
    }) => {
        await openScene(page, "geometry", {
            top: 20,
            left: 240,
            width: 420,
            height: 60,
        });
        await selectText(page, "[data-testid=geometry-p]", 0, 10);
        await expectOpen(page, "geometry-status");

        const lines = await getSelectionLines(page);
        const popup = page.getByTestId("geometry-popup");
        const box = await popup.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(
            lines[lines.length - 1]!.bottom + 8 - 0.5,
        );
    });

    test("anchors a wrapped selection to its first visible line", async ({
        page,
    }) => {
        await openScene(page, "geometry", {
            top: 300,
            left: 240,
            width: 300,
            height: 40,
        });
        await selectContents(page, "[data-testid=geometry-p]");
        await expectOpen(page, "geometry-status");

        const lines = await getSelectionLines(page);
        expect(lines.length).toBeGreaterThan(2);

        const popup = page.getByTestId("geometry-popup");
        const box = await popup.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y + box!.height).toBeLessThanOrEqual(
            lines[0]!.top - 8 + 0.5,
        );
        const firstLineCenter = (lines[0]!.left + lines[0]!.right) / 2;
        const popupCenter = box!.x + box!.width / 2;
        expect(Math.abs(popupCenter - firstLineCenter)).toBeLessThan(2);
    });

    test("shifts the toolbar inside the viewport at the right edge", async ({
        page,
    }) => {
        await openScene(page, "geometry", {
            top: 300,
            left: 760,
            width: 100,
            align: "right",
            text: "Right edge",
            height: 40,
        });
        await selectText(page, "[data-testid=geometry-p]", 0, 5);
        await expectOpen(page, "geometry-status");

        const popup = page.getByTestId("geometry-popup");
        const box = await popup.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(8 - 0.5);
        expect(box!.x + box!.width).toBeLessThanOrEqual(900 - 8 + 0.5);
    });

    test("closes with collision when neither side fits", async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 200 });
        await openScene(page, "geometry", {
            top: 80,
            left: 240,
            width: 420,
            height: 120,
        });
        await selectText(page, "[data-testid=geometry-p]", 0, 10);

        await expectClosed(page, "geometry-status", "collision");
        await expect(page.getByTestId("geometry-popup")).toHaveCount(0);
        await expect
            .poll(() => page.evaluate(() => window.__selectionEvents))
            .toContainEqual({
                label: "Geometry actions",
                open: false,
                reason: "collision",
            });
    });

    test("follows the selection while the page scrolls", async ({ page }) => {
        await page.setViewportSize({ width: 900, height: 500 });
        await openScene(page, "geometry", {
            top: 200,
            left: 240,
            width: 420,
            height: 40,
        });
        await selectText(page, "[data-testid=geometry-p]", 0, 10);
        await expectOpen(page, "geometry-status");

        const popup = page.getByTestId("geometry-popup");
        const before = await popup.boundingBox();
        expect(before).not.toBeNull();

        await page.evaluate(() => {
            window.scrollTo(0, 100);
        });
        await page.waitForTimeout(250);

        const after = await popup.boundingBox();
        expect(after).not.toBeNull();
        expect(before!.y - after!.y).toBeGreaterThan(95);
        expect(before!.y - after!.y).toBeLessThan(105);
        await expect(page.getByTestId("geometry-status")).toHaveAttribute(
            "data-open",
            "true",
        );
    });
});
