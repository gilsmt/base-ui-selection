import { expect, test } from "@playwright/test";
import {
    clearSelection,
    dragSelect,
    expectClosed,
    expectOpen,
    getSelectionLines,
    openScene,
    selectText,
} from "./helpers";

test.describe("editor", () => {
    test("opens above a mouse selection without moving focus", async ({
        page,
    }) => {
        await openScene(page, "editor");
        const editor = page.getByTestId("editor");
        await dragSelect(page, page.getByTestId("editor-p1"));

        await expectOpen(page, "editor-status");
        const popup = page.getByTestId("editor-popup");
        await expect(popup).toBeVisible();
        await expect(popup).toHaveAttribute("role", "toolbar");
        await expect(popup).toHaveAttribute("aria-label", "Editor actions");
        await expect(popup).toHaveAttribute("aria-keyshortcuts", "Alt+F10");
        await expect(editor).toBeFocused();

        const lines = await getSelectionLines(page);
        expect(lines.length).toBeGreaterThan(0);
        const popupBox = await popup.boundingBox();
        expect(popupBox).not.toBeNull();
        expect(popupBox!.y + popupBox!.height).toBeLessThanOrEqual(
            lines[0]!.top - 8 + 0.5,
        );
        expect(popupBox!.y).toBeGreaterThanOrEqual(8);
    });

    test("applies an action, closes, and keeps the selection and focus", async ({
        page,
    }) => {
        await openScene(page, "editor");
        const editor = page.getByTestId("editor");
        await dragSelect(page, page.getByTestId("editor-p1"));
        await expectOpen(page, "editor-status");

        const selected = await page.evaluate(() =>
            document.getSelection()?.toString(),
        );
        expect(selected?.length).toBeGreaterThan(0);

        await page.getByTestId("item-bold").click();

        await expectClosed(page, "editor-status", "close-press");
        await expect(page.getByTestId("editor-popup")).toHaveCount(0);
        await expect(editor).toBeFocused();
        await expect(editor.locator("b, strong")).toHaveCount(1);
        expect(await page.evaluate(() => document.getSelection()?.toString()))
            .toBe(selected);
        await expect
            .poll(() => page.evaluate(() => window.__selectionEvents))
            .toEqual([
                { label: "Editor actions", open: true, reason: "auto-open" },
                { label: "Editor actions", open: false, reason: "close-press" },
            ]);
    });

    test("supports the Alt+F10 shortcut, Escape, and Tab", async ({ page }) => {
        await openScene(page, "editor");
        const editor = page.getByTestId("editor");
        await dragSelect(page, page.getByTestId("editor-p1"));
        await expectOpen(page, "editor-status");

        await page.keyboard.press("Alt+F10");
        const bold = page.getByTestId("item-bold");
        await expect(bold).toBeFocused();
        expect(
            await page.evaluate(() => document.getSelection()?.toString()),
        ).not.toBe("");

        await page.keyboard.press("Escape");
        await expectClosed(page, "editor-status", "escape-key");
        await expect(page.getByTestId("editor-popup")).toHaveCount(0);
        await expect(editor).toBeFocused();
        expect(
            await page.evaluate(() => document.getSelection()?.toString()),
        ).not.toBe("");

        await page.keyboard.press("Alt+F10");
        await expect(bold).toBeFocused();
        await page.keyboard.press("Tab");
        await expectClosed(page, "editor-status", "tab-out");
        await expect(page.getByTestId("editor-popup")).toHaveCount(0);
        await expect(editor).toBeFocused();

        await page.keyboard.press("Tab");
        await expect(editor).not.toBeFocused();
    });

    test("closes on an outside press without clearing the selection", async ({
        page,
    }) => {
        await openScene(page, "editor");
        await dragSelect(page, page.getByTestId("editor-p1"));
        await expectOpen(page, "editor-status");
        const selected = await page.evaluate(() =>
            document.getSelection()?.toString(),
        );

        await page.getByTestId("outside-button").click();

        await expectClosed(page, "editor-status", "outside-press");
        await expect(page.getByTestId("editor-popup")).toHaveCount(0);
        expect(await page.evaluate(() => document.getSelection()?.toString()))
            .toBe(selected);
    });

    test("closes with selection-clear when the selection becomes empty", async ({
        page,
    }) => {
        await openScene(page, "editor");
        await dragSelect(page, page.getByTestId("editor-p1"));
        await expectOpen(page, "editor-status");

        await clearSelection(page);

        await expectClosed(page, "editor-status", "selection-clear");
        await expect(page.getByTestId("editor-popup")).toHaveCount(0);
    });

    test("updates the open toolbar when the selection changes", async ({
        page,
    }) => {
        await openScene(page, "editor");
        await selectText(page, "[data-testid=editor-p1]", 0, 5);
        await expectOpen(page, "editor-status");
        const status = page.getByTestId("editor-status");
        await expect(status).toHaveAttribute("data-length", "5");
        await expect(status).toContainText("Alpha");

        await selectText(page, "[data-testid=editor-p1]", 103, 110);

        await expect(status).toHaveAttribute("data-open", "true");
        await expect(status).toHaveAttribute("data-length", "7");
    });

    test("keeps the toolbar open for an item with closeOnClick false", async ({
        page,
    }) => {
        await openScene(page, "editor");
        await dragSelect(page, page.getByTestId("editor-p1"));
        await expectOpen(page, "editor-status");

        await page.getByTestId("item-stay").click();
        await expect(page.getByTestId("editor-popup")).toBeVisible();
        await expect(page.getByTestId("editor-status")).toHaveAttribute(
            "data-open",
            "true",
        );

        await page.keyboard.press("Escape");
        await expectClosed(page, "editor-status", "escape-key");
    });

    test("suppresses auto-open for a synthetic touch gesture", async ({
        page,
    }) => {
        await openScene(page, "editor");
        const editor = page.getByTestId("editor");

        await page.evaluate(() => {
            document
                .querySelector("[data-testid=editor]")
                ?.dispatchEvent(
                    new PointerEvent("pointerdown", {
                        bubbles: true,
                        button: 0,
                        pointerType: "touch",
                    }),
                );
        });
        await selectText(page, "[data-testid=editor-p1]", 0, 8);
        await page.evaluate(() => {
            document
                .querySelector("[data-testid=editor]")
                ?.dispatchEvent(
                    new PointerEvent("pointerup", {
                        bubbles: true,
                        button: 0,
                        pointerType: "touch",
                    }),
                );
        });
        await page.waitForTimeout(250);

        await expect(page.getByTestId("editor-status")).toHaveAttribute(
            "data-open",
            "false",
        );
        await expect(page.getByTestId("editor-status")).toHaveAttribute(
            "data-length",
            "8",
        );
        await expect(page.getByTestId("editor-popup")).toHaveCount(0);

        await page.reload();
        await dragSelect(page, page.getByTestId("editor-p1"));
        await expectOpen(page, "editor-status");
        await expect(editor).toBeFocused();
    });
});
