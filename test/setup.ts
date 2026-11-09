import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost/" });

for (const key of Object.getOwnPropertyNames(window)) {
    if (key in globalThis) {
        continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(window, key);
    if (!descriptor) {
        continue;
    }
    Object.defineProperty(globalThis, key, {
        ...descriptor,
        configurable: true,
    });
}

Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: window,
});

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    value: true,
});

const rect = (left: number, top: number, right: number, bottom: number) =>
    new window.DOMRect(left, top, right - left, bottom - top);

const selectionRect = rect(10, 100, 110, 120);

// Happy DOM has no layout engine, so tests provide the geometry that the
// selection code expects from a browser.
Object.defineProperty(window.Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [selectionRect],
});

Object.defineProperty(window.Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => selectionRect,
});
