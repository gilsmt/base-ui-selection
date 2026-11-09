import { expect, test } from "@playwright/test";
import {
    dragSelect,
    expectClosed,
    expectOpen,
    openScene,
    selectText,
} from "./helpers";

test.describe("manual opening", () => {
    test("does not auto-open and opens from the shortcut", async ({ page }) => {
        await openScene(page, "manual");
        await dragSelect(page, page.getByTestId("manual-p"));

        await expect(page.getByTestId("manual-status")).toHaveAttribute(
            "data-open",
            "false",
        );
        await expect(page.getByTestId("manual-popup")).toHaveCount(0);

        await page.keyboard.press("Alt+F10");

        await expectOpen(page, "manual-status", "none");
        await expect(page.getByTestId("manual-popup")).toBeVisible();
        await expect(page.getByRole("button", { name: "Action" })).toBeFocused();
    });

    test("Escape restores focus and the selection after a manual open", async ({
        page,
    }) => {
        await openScene(page, "manual");
        await dragSelect(page, page.getByTestId("manual-p"));
        await page.keyboard.press("Alt+F10");
        await expectOpen(page, "manual-status", "none");

        await page.keyboard.press("Escape");

        await expectClosed(page, "manual-status", "escape-key");
        await expect(page.getByTestId("manual-area")).toBeFocused();
        expect(
            await page.evaluate(() => document.getSelection()?.toString()),
        ).not.toBe("");
    });

    test("disables the shortcut and its announcement", async ({ page }) => {
        await openScene(page, "no-shortcut");
        await selectText(page, "[data-testid=no-shortcut-p]", 0, 5);

        await expectOpen(page, "no-shortcut-status");
        const popup = page.getByTestId("no-shortcut-popup");
        await expect(popup).toBeVisible();
        expect(await popup.getAttribute("aria-keyshortcuts")).toBeNull();
        await expect(
            page.locator("[role=status]"),
        ).toHaveText("No shortcut actions available.");

        const activeBefore = await page.evaluate(
            () => document.activeElement?.tagName,
        );
        await page.keyboard.press("Alt+F10");
        const activeAfter = await page.evaluate(
            () => document.activeElement?.tagName,
        );

        expect(activeAfter).toBe(activeBefore);
        await expect(
            page.getByRole("button", { name: "Action" }),
        ).not.toBeFocused();
    });
});
