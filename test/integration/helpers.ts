import { expect, type Locator, type Page } from "@playwright/test";

export interface LineRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

export async function openScene(
    page: Page,
    scene: string,
    params: Record<string, string | number> = {},
): Promise<void> {
    const search = new URLSearchParams({ scene });
    for (const [key, value] of Object.entries(params)) {
        search.set(key, String(value));
    }
    await page.goto(`/?${search.toString()}`);
    await page.evaluate(() => {
        window.__selectionEvents = [];
    });
}

export async function selectText(
    page: Page,
    selector: string,
    start = 0,
    end = 5,
): Promise<void> {
    await page.evaluate(
        ({ selector, start, end }) => {
            const element = document.querySelector(selector);
            const node = element?.firstChild;
            if (!node) {
                throw new Error(`Missing text node for ${selector}`);
            }
            const range = document.createRange();
            range.setStart(node, start);
            range.setEnd(node, end);
            const selection = document.getSelection();
            if (!selection) {
                throw new Error("Missing document selection");
            }
            selection.removeAllRanges();
            selection.addRange(range);
        },
        { selector, start, end },
    );
    await page.waitForTimeout(250);
}

export async function selectContents(
    page: Page,
    selector: string,
): Promise<void> {
    await page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (!element) {
            throw new Error(`Missing element ${selector}`);
        }
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = document.getSelection();
        if (!selection) {
            throw new Error("Missing document selection");
        }
        selection.removeAllRanges();
        selection.addRange(range);
    }, selector);
    await page.waitForTimeout(250);
}

export async function selectAcross(
    page: Page,
    startSelector: string,
    endSelector: string,
): Promise<void> {
    await page.evaluate(
        ({ startSelector, endSelector }) => {
            const startElement = document.querySelector(startSelector);
            const endElement = document.querySelector(endSelector);
            const startNode = startElement?.firstChild;
            const endNode = endElement?.firstChild;
            if (!startNode || !endNode) {
                throw new Error("Missing text node for cross-boundary selection");
            }
            const range = document.createRange();
            range.setStart(startNode, 2);
            range.setEnd(endNode, Math.min(4, endNode.textContent?.length ?? 0));
            const selection = document.getSelection();
            if (!selection) {
                throw new Error("Missing document selection");
            }
            selection.removeAllRanges();
            selection.addRange(range);
        },
        { startSelector, endSelector },
    );
    await page.waitForTimeout(250);
}

export async function dragSelect(page: Page, target: Locator): Promise<void> {
    const box = await target.boundingBox();
    if (!box) {
        throw new Error("Selection target has no bounding box.");
    }
    await page.mouse.move(box.x + 4, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + Math.min(box.width - 4, 240), box.y + 10, {
        steps: 12,
    });
    await page.mouse.up();
    await page.waitForTimeout(250);
}

export async function clearSelection(page: Page): Promise<void> {
    await page.evaluate(() => {
        document.getSelection()?.removeAllRanges();
    });
    await page.waitForTimeout(250);
}

export async function getSelectionLines(page: Page): Promise<LineRect[]> {
    return page.evaluate(() => {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
            throw new Error("Missing document selection");
        }
        const rects = Array.from(selection.getRangeAt(0).getClientRects())
            .filter((rect) => rect.height > 0)
            .map((rect) => ({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
            }))
            .sort((a, b) => a.top - b.top || a.left - b.left);

        const lines: LineRect[] = [];
        let previousTop = 0;
        let previousHeight = 0;
        for (const rect of rects) {
            const line = lines[lines.length - 1];
            if (!line || rect.top - previousTop > previousHeight / 2) {
                lines.push({ ...rect });
            } else {
                line.left = Math.min(line.left, rect.left);
                line.top = Math.min(line.top, rect.top);
                line.right = Math.max(line.right, rect.right);
                line.bottom = Math.max(line.bottom, rect.bottom);
                line.width = line.right - line.left;
                line.height = line.bottom - line.top;
            }
            previousTop = rect.top;
            previousHeight = rect.height;
        }
        return lines;
    });
}

export async function expectOpen(
    page: Page,
    testId: string,
    reason: string | null = "auto-open",
): Promise<void> {
    const status = page.getByTestId(testId);
    await expect(status).toHaveAttribute("data-open", "true");
    if (reason !== null) {
        await expect(status).toHaveAttribute("data-reason", reason);
    }
}

export async function expectClosed(
    page: Page,
    testId: string,
    reason: string,
): Promise<void> {
    const status = page.getByTestId(testId);
    await expect(status).toHaveAttribute("data-open", "false");
    await expect(status).toHaveAttribute("data-reason", reason);
}
