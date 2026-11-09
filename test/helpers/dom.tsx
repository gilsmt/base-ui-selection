import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const mounted: Array<{ root: Root; container: HTMLDivElement }> = [];

export function render(element: React.ReactNode): HTMLDivElement {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
        root.render(element);
    });
    mounted.push({ root, container });
    return container;
}

export function cleanup(): void {
    for (const { root, container } of mounted.splice(0)) {
        act(() => {
            root.unmount();
        });
        container.remove();
    }
    document.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
}

export function getTextNode(element: Element): Text {
    const node = element.firstChild;
    if (!(node instanceof Text)) {
        throw new Error("Expected the element to start with a text node.");
    }
    return node;
}

export function selectText(element: Element, start = 0, end = 5): void {
    const node = getTextNode(element);
    selectRange(node, start, node, end);
}

export function selectRange(
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number,
): void {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = document.getSelection();
    if (!selection) {
        throw new Error("Expected a document selection.");
    }
    selection.removeAllRanges();
    selection.addRange(range);
}

export function collapseSelection(): void {
    const selection = document.getSelection();
    if (!selection) {
        return;
    }
    if (selection.rangeCount > 0) {
        selection.collapseToEnd();
        return;
    }
    selection.removeAllRanges();
}

export function clearSelection(): void {
    document.getSelection()?.removeAllRanges();
}

export function dispatchPointer(
    target: EventTarget,
    type: "pointerdown" | "pointerup" | "pointercancel",
    pointerType: "mouse" | "touch" | "pen",
): void {
    const event = new window.PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerType,
        button: 0,
        isPrimary: true,
    });
    act(() => {
        target.dispatchEvent(event);
    });
}

export function dispatchSelectionChange(): void {
    act(() => {
        document.dispatchEvent(new window.Event("selectionchange"));
    });
}

export function dispatchKey(
    target: EventTarget,
    init: KeyboardEventInit,
): KeyboardEvent {
    const event = new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        ...init,
    });
    act(() => {
        target.dispatchEvent(event);
    });
    return event;
}

export function dispatchShortcut(
    init: KeyboardEventInit,
    target: EventTarget = document,
): KeyboardEvent {
    return dispatchKey(target, init);
}

export function click(element: Element): void {
    if (!(element instanceof HTMLElement)) {
        throw new Error("Expected an HTML element.");
    }
    act(() => {
        element.click();
    });
}

export async function waitForSettle(delay = 200): Promise<void> {
    await act(async () => {
        await new Promise((resolve) => {
            window.setTimeout(resolve, delay);
        });
    });
}

export function getToolbar(label: string): HTMLElement | null {
    const toolbars = document.querySelectorAll<HTMLElement>("[role=toolbar]");
    for (const toolbar of toolbars) {
        if (toolbar.getAttribute("aria-label") === label) {
            return toolbar;
        }
    }
    return null;
}

export function getItem(toolbar: HTMLElement, name: string): HTMLElement {
    const items = toolbar.querySelectorAll<HTMLElement>(
        "[data-base-ui-selection-item]",
    );
    for (const item of items) {
        if (item.textContent === name) {
            return item;
        }
    }
    throw new Error(`Missing toolbar item: ${name}`);
}
