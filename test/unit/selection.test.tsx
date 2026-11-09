import { afterEach, describe, expect, test } from "bun:test";
import * as React from "react";
import {
    Selection,
    useSelection,
    useSelectionState,
} from "../../src/selection";
import {
    cleanup,
    clearSelection,
    click,
    dispatchKey,
    dispatchPointer,
    dispatchSelectionChange,
    dispatchShortcut,
    getItem,
    getTextNode,
    getToolbar,
    render,
    selectRange,
    selectText,
    waitForSettle,
} from "../helpers/dom";

afterEach(cleanup);

interface Change {
    open: boolean;
    reason: string;
}

function StateProbe() {
    const { open, selection } = useSelectionState();
    return (
        <output data-testid="state">
            {open ? "open" : "closed"}:{selection?.text ?? "none"}
        </output>
    );
}

function ActionItem({
    name = "Bold",
    closeOnClick = true,
    onRun,
}: {
    name?: string | undefined;
    closeOnClick?: boolean | undefined;
    onRun?: ((text: string) => void) | undefined;
}) {
    const selection = useSelection();
    return (
        <Selection.Item
            closeOnClick={closeOnClick}
            onClick={() => {
                onRun?.(document.getSelection()?.toString() ?? "");
                selection.restore();
            }}
        >
            {name}
        </Selection.Item>
    );
}

function TestToolbar({
    onRun,
    closeOnClick = true,
}: {
    onRun?: ((text: string) => void) | undefined;
    closeOnClick?: boolean | undefined;
}) {
    return (
        <Selection.Portal>
            <Selection.Positioner>
                <Selection.Popup>
                    <ActionItem onRun={onRun} />
                    <Selection.Separator />
                    <ActionItem
                        name="Stay"
                        closeOnClick={closeOnClick}
                        onRun={onRun}
                    />
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function Harness({
    autoOpen,
    focusShortcut,
    announcement,
    defaultOpen,
    onOpenChange,
    onRun,
    closeOnClick,
    text = "Hello world",
}: {
    autoOpen?: boolean | undefined;
    focusShortcut?: string | false | undefined;
    announcement?: string | undefined;
    defaultOpen?: boolean | undefined;
    onOpenChange?: ((open: boolean, reason: string) => void) | undefined;
    onRun?: ((text: string) => void) | undefined;
    closeOnClick?: boolean | undefined;
    text?: string | undefined;
}) {
    return (
        <Selection.Root
            label="Test toolbar"
            autoOpen={autoOpen}
            focusShortcut={focusShortcut}
            announcement={announcement}
            defaultOpen={defaultOpen}
            onOpenChange={onOpenChange}
        >
            <Selection.Area>
                <p>{text}</p>
            </Selection.Area>
            <StateProbe />
            <TestToolbar onRun={onRun} closeOnClick={closeOnClick} />
        </Selection.Root>
    );
}

function state(container: Element): string {
    return container.querySelector("[data-testid=state]")?.textContent ?? "";
}

function RefHarness({
    areaRef,
    popupRef,
    positionerRef,
    itemRef,
}: {
    areaRef: React.Ref<HTMLDivElement>;
    popupRef: React.Ref<HTMLDivElement>;
    positionerRef: React.Ref<HTMLDivElement>;
    itemRef: React.Ref<HTMLButtonElement>;
}) {
    return (
        <Selection.Root label="Test toolbar">
            <Selection.Area ref={areaRef}>
                <p>Hello world</p>
            </Selection.Area>
            <Selection.Portal>
                <Selection.Positioner ref={positionerRef}>
                    <Selection.Popup ref={popupRef}>
                        <Selection.Item ref={itemRef}>Bold</Selection.Item>
                    </Selection.Popup>
                </Selection.Positioner>
            </Selection.Portal>
        </Selection.Root>
    );
}

describe("auto-open", () => {
    test("opens for a valid selection after the settle delay", async () => {
        const changes: Change[] = [];
        const container = render(
            <Harness
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
            />,
        );

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        expect(state(container)).toBe("closed:none");

        await waitForSettle();

        expect(state(container)).toBe("open:Hello");
        expect(changes).toEqual([{ open: true, reason: "auto-open" }]);
        expect(getToolbar("Test toolbar")).not.toBeNull();
    });

    test("does not scan the selection that exists at mount", async () => {
        const area = document.createElement("div");
        const paragraph = document.createElement("p");
        paragraph.textContent = "Hello world";
        area.append(paragraph);
        document.body.append(area);
        selectText(paragraph);

        const container = render(<Harness />);
        await waitForSettle(300);

        expect(state(container)).toBe("closed:none");
        expect(getToolbar("Test toolbar")).toBeNull();
    });

    test("ignores collapsed and whitespace-only selections", async () => {
        const container = render(<Harness text="     " />);
        const paragraph = container.querySelector("p")!;

        selectText(paragraph, 2, 4);
        dispatchSelectionChange();
        await waitForSettle();
        expect(state(container)).toBe("closed:none");

        selectText(paragraph, 1, 1);
        dispatchSelectionChange();
        await waitForSettle();
        expect(state(container)).toBe("closed:none");

        expect(getToolbar("Test toolbar")).toBeNull();
    });

    test("does not open when autoOpen is false", async () => {
        const container = render(<Harness autoOpen={false} />);
        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(state(container)).toBe("closed:Hello");
        expect(getToolbar("Test toolbar")).toBeNull();
    });

    test("suppresses auto-open for a touch gesture", async () => {
        const container = render(<Harness />);
        const paragraph = container.querySelector("p")!;

        dispatchPointer(paragraph, "pointerdown", "touch");
        selectText(paragraph);
        dispatchSelectionChange();
        dispatchPointer(paragraph, "pointerup", "touch");
        await waitForSettle();

        expect(state(container)).toBe("closed:Hello");
        expect(getToolbar("Test toolbar")).toBeNull();

        dispatchPointer(paragraph, "pointerdown", "mouse");
        dispatchPointer(paragraph, "pointerup", "mouse");
        await waitForSettle();

        expect(state(container)).toBe("open:Hello");
    });

    test("opens for a later programmatic selection after a touch gesture", async () => {
        const container = render(<Harness text="Hello world" />);
        const paragraph = container.querySelector("p")!;

        dispatchPointer(paragraph, "pointerdown", "touch");
        selectText(paragraph, 0, 5);
        dispatchSelectionChange();
        dispatchPointer(paragraph, "pointerup", "touch");
        await waitForSettle();

        expect(state(container)).toBe("closed:Hello");

        selectText(paragraph, 6, 11);
        dispatchSelectionChange();
        await waitForSettle();

        expect(state(container)).toBe("open:world");
    });

    test("opens for a pen gesture", async () => {
        const container = render(<Harness />);
        const paragraph = container.querySelector("p")!;

        dispatchPointer(paragraph, "pointerdown", "pen");
        selectText(paragraph);
        dispatchPointer(paragraph, "pointerup", "pen");
        await waitForSettle();

        expect(state(container)).toBe("open:Hello");
    });
});

describe("interaction", () => {
    test("updates an open toolbar when the selection changes", async () => {
        const container = render(<Harness text="Hello world" />);
        const paragraph = container.querySelector("p")!;

        selectText(paragraph, 0, 5);
        dispatchSelectionChange();
        await waitForSettle();
        expect(state(container)).toBe("open:Hello");

        selectText(paragraph, 6, 11);
        dispatchSelectionChange();
        await waitForSettle();

        expect(state(container)).toBe("open:world");
    });

    test("keeps the snapshot while focus is inside the popup", async () => {
        const container = render(<Harness />);
        const paragraph = container.querySelector("p")!;

        selectText(paragraph, 0, 5);
        dispatchSelectionChange();
        await waitForSettle();

        dispatchShortcut({ key: "F10", code: "F10", altKey: true });
        const item = getItem(getToolbar("Test toolbar")!, "Bold");
        expect(document.activeElement).toBe(item);

        selectText(paragraph, 6, 11);
        dispatchSelectionChange();
        await waitForSettle();

        expect(state(container)).toBe("open:Hello");
    });

    test("closes with selection-clear when the selection becomes empty", async () => {
        const changes: Change[] = [];
        const container = render(
            <Harness
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
            />,
        );

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        clearSelection();
        dispatchSelectionChange();
        await waitForSettle();

        expect(state(container)).toBe("closed:none");
        expect(changes).toEqual([
            { open: true, reason: "auto-open" },
            { open: false, reason: "selection-clear" },
        ]);
    });

    test("runs the item handler before closing and restores the selection", async () => {
        const changes: Change[] = [];
        const seen: string[] = [];
        const container = render(
            <Harness
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
                onRun={(text) => {
                    seen.push(text);
                }}
            />,
        );

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        click(getItem(getToolbar("Test toolbar")!, "Bold"));

        expect(seen).toEqual(["Hello"]);
        expect(changes).toEqual([
            { open: true, reason: "auto-open" },
            { open: false, reason: "close-press" },
        ]);
        expect(state(container)).toBe("closed:Hello");
        expect(document.getSelection()?.toString()).toBe("Hello");
    });

    test("keeps the toolbar open when closeOnClick is false", async () => {
        const changes: Change[] = [];
        const container = render(
            <Harness
                closeOnClick={false}
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
            />,
        );

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        click(getItem(getToolbar("Test toolbar")!, "Stay"));

        expect(state(container)).toBe("open:Hello");
        expect(changes).toEqual([{ open: true, reason: "auto-open" }]);
    });

    test("focuses the first item with Alt+F10 when autoOpen is false", async () => {
        const container = render(<Harness autoOpen={false} />);
        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        const event = dispatchShortcut({
            key: "F10",
            code: "F10",
            altKey: true,
        });
        await waitForSettle(50);

        expect(event.defaultPrevented).toBe(true);
        expect(state(container)).toBe("open:Hello");
        expect(document.activeElement).toBe(
            getItem(getToolbar("Test toolbar")!, "Bold"),
        );
    });

    test("supports a custom focus shortcut", async () => {
        const container = render(<Harness focusShortcut="Cmd+Shift+K" />);
        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        dispatchShortcut({
            key: "k",
            code: "KeyK",
            metaKey: true,
            shiftKey: true,
        });

        expect(state(container)).toBe("open:Hello");
        expect(
            getToolbar("Test toolbar")?.getAttribute("aria-keyshortcuts"),
        ).toBe("Meta+Shift+K");
    });

    test("ignores the shortcut when focusShortcut is false", async () => {
        const container = render(
            <Harness focusShortcut={false} defaultOpen />,
        );
        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(document.activeElement).not.toBe(
            getItem(getToolbar("Test toolbar")!, "Bold"),
        );
        const event = dispatchShortcut({
            key: "F10",
            code: "F10",
            altKey: true,
        });

        expect(event.defaultPrevented).toBe(false);
        expect(
            getToolbar("Test toolbar")?.getAttribute("aria-keyshortcuts"),
        ).toBeNull();
        expect(document.activeElement).not.toBe(
            getItem(getToolbar("Test toolbar")!, "Bold"),
        );
    });
});

describe("dismissal", () => {
    test("closes on Escape and restores focus and the selection", async () => {
        const changes: Change[] = [];
        const container = render(
            <Harness
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
            />,
        );
        const paragraph = container.querySelector("p")!;

        selectText(paragraph);
        dispatchSelectionChange();
        await waitForSettle();
        dispatchShortcut({ key: "F10", code: "F10", altKey: true });

        const item = getItem(getToolbar("Test toolbar")!, "Bold");
        dispatchKey(item, { key: "Escape" });
        await waitForSettle(50);

        expect(state(container)).toBe("closed:Hello");
        expect(changes.at(-1)).toEqual({ open: false, reason: "escape-key" });
        expect(document.getSelection()?.toString()).toBe("Hello");
        expect(document.activeElement).toBe(paragraph.closest(
            "[data-base-ui-selection-area]",
        ));
    });

    test("closes on Tab and restores focus and the selection", async () => {
        const changes: Change[] = [];
        const container = render(
            <Harness
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
            />,
        );
        const paragraph = container.querySelector("p")!;

        selectText(paragraph);
        dispatchSelectionChange();
        await waitForSettle();
        dispatchShortcut({ key: "F10", code: "F10", altKey: true });

        const item = getItem(getToolbar("Test toolbar")!, "Bold");
        const event = dispatchKey(item, { key: "Tab" });
        await waitForSettle(50);

        expect(event.defaultPrevented).toBe(true);
        expect(state(container)).toBe("closed:Hello");
        expect(changes.at(-1)).toEqual({ open: false, reason: "tab-out" });
        expect(document.getSelection()?.toString()).toBe("Hello");
        expect(document.activeElement).toBe(paragraph.closest(
            "[data-base-ui-selection-area]",
        ));
    });

});

describe("controlled open", () => {
    function ControlledHarness({
        onOpenChange,
    }: {
        onOpenChange: (open: boolean, reason: string) => void;
    }) {
        const [open, setOpen] = React.useState(true);
        return (
            <>
                <button
                    type="button"
                    data-testid="close-request"
                    onClick={() => {
                        setOpen(false);
                    }}
                >
                    Close request
                </button>
                <button
                    type="button"
                    data-testid="open-request"
                    onClick={() => {
                        setOpen(true);
                    }}
                >
                    Open request
                </button>
                <Selection.Root
                    label="Test toolbar"
                    open={open}
                    onOpenChange={onOpenChange}
                >
                    <Selection.Area>
                        <p>Hello world</p>
                    </Selection.Area>
                    <StateProbe />
                    <TestToolbar />
                </Selection.Root>
            </>
        );
    }

    test("a dismissal wins while the parent keeps open true", async () => {
        const changes: Change[] = [];
        const container = render(
            <ControlledHarness
                onOpenChange={(open, reason) => {
                    changes.push({ open, reason });
                }}
            />,
        );

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();
        expect(state(container)).toBe("open:Hello");

        click(getItem(getToolbar("Test toolbar")!, "Bold"));
        await waitForSettle(50);

        expect(state(container)).toBe("closed:Hello");
        expect(changes.at(-1)).toEqual({
            open: false,
            reason: "close-press",
        });

        click(container.querySelector("[data-testid=close-request]")!);
        click(container.querySelector("[data-testid=open-request]")!);
        await waitForSettle(50);

        expect(state(container)).toBe("open:Hello");
    });

    test("opens after a selection when the parent already requested open", async () => {
        const container = render(
            <ControlledHarness onOpenChange={() => {}} />,
        );

        expect(state(container)).toBe("closed:none");
        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(state(container)).toBe("open:Hello");
    });
});

describe("accessibility", () => {
    test("keeps the live region mounted and announces the open toolbar", async () => {
        const container = render(<Harness />);
        const status = container.querySelector("[role=status]")!;

        expect(status.getAttribute("aria-live")).toBe("polite");
        expect(status.getAttribute("aria-atomic")).toBe("true");
        expect(status.textContent).toBe("");

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(status.textContent).toBe(
            "Test toolbar available. Press Alt+F10 to focus the toolbar.",
        );

        expect(
            getToolbar("Test toolbar")?.getAttribute("aria-keyshortcuts"),
        ).toBe("Alt+F10");

        clearSelection();
        dispatchSelectionChange();
        await waitForSettle();
        expect(status.textContent).toBe("");
    });

    test("uses a custom announcement and omits a disabled shortcut", async () => {
        const container = render(
            <Harness
                announcement="Formatting actions are ready."
                focusShortcut={false}
                defaultOpen
            />,
        );
        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(container.querySelector("[role=status]")?.textContent).toBe(
            "Formatting actions are ready.",
        );

        const containerWithoutAnnouncement = render(
            <Harness focusShortcut={false} defaultOpen />,
        );
        selectText(containerWithoutAnnouncement.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(
            containerWithoutAnnouncement.querySelector("[role=status]")
                ?.textContent,
        ).toBe("Test toolbar available.");
    });

    test("does not move focus when the toolbar opens", async () => {
        const container = render(<Harness />);
        const paragraph = container.querySelector("p")!;
        const area = paragraph.closest("[data-base-ui-selection-area]")!;
        (area as HTMLElement).focus();

        selectText(paragraph);
        dispatchSelectionChange();
        await waitForSettle();

        expect(document.activeElement).toBe(area);
    });

    test("defaults the area to tabIndex -1", () => {
        const container = render(<Harness />);
        const area = container.querySelector("[data-base-ui-selection-area]");
        expect((area as HTMLElement).tabIndex).toBe(-1);
    });
});

describe("nested areas", () => {
    function NestedHarness({
        onOuterChange,
        onInnerChange,
    }: {
        onOuterChange: (open: boolean, reason: string) => void;
        onInnerChange: (open: boolean, reason: string) => void;
    }) {
        return (
            <Selection.Root label="Outer toolbar" onOpenChange={onOuterChange}>
                <Selection.Area>
                    <p data-testid="outer">Outer text</p>
                    <Selection.Root
                        label="Inner toolbar"
                        onOpenChange={onInnerChange}
                    >
                        <Selection.Area>
                            <p data-testid="inner">Inner text</p>
                        </Selection.Area>
                        <Selection.Portal>
                            <Selection.Positioner>
                                <Selection.Popup>
                                    <Selection.Item>Inner action</Selection.Item>
                                </Selection.Popup>
                            </Selection.Positioner>
                        </Selection.Portal>
                    </Selection.Root>
                </Selection.Area>
                <Selection.Portal>
                    <Selection.Positioner>
                        <Selection.Popup>
                            <Selection.Item>Outer action</Selection.Item>
                        </Selection.Popup>
                    </Selection.Positioner>
                </Selection.Portal>
            </Selection.Root>
        );
    }

    test("opens only the innermost area", async () => {
        const outer: Change[] = [];
        const inner: Change[] = [];
        const container = render(
            <NestedHarness
                onOuterChange={(open, reason) => {
                    outer.push({ open, reason });
                }}
                onInnerChange={(open, reason) => {
                    inner.push({ open, reason });
                }}
            />,
        );

        selectText(container.querySelector("[data-testid=inner]")!);
        dispatchSelectionChange();
        await waitForSettle();

        expect(getToolbar("Inner toolbar")).not.toBeNull();
        expect(getToolbar("Outer toolbar")).toBeNull();
        expect(inner).toEqual([{ open: true, reason: "auto-open" }]);
        expect(outer).toEqual([]);
    });

    test("opens no toolbar when the selection crosses a boundary", async () => {
        const outer: Change[] = [];
        const inner: Change[] = [];
        const container = render(
            <NestedHarness
                onOuterChange={(open, reason) => {
                    outer.push({ open, reason });
                }}
                onInnerChange={(open, reason) => {
                    inner.push({ open, reason });
                }}
            />,
        );

        const outerText = getTextNode(
            container.querySelector("[data-testid=outer]")!,
        );
        const innerText = getTextNode(
            container.querySelector("[data-testid=inner]")!,
        );
        selectRange(outerText, 2, innerText, 4);
        dispatchSelectionChange();
        await waitForSettle();

        expect(getToolbar("Inner toolbar")).toBeNull();
        expect(getToolbar("Outer toolbar")).toBeNull();
        expect(inner).toEqual([]);
        expect(outer).toEqual([]);
    });
});

describe("refs", () => {
    test("passes refs to the rendered elements", async () => {
        const areaRef = React.createRef<HTMLDivElement>();
        const popupRef = React.createRef<HTMLDivElement>();
        const positionerRef = React.createRef<HTMLDivElement>();
        const itemRef = React.createRef<HTMLButtonElement>();
        const container = render(
            <RefHarness
                areaRef={areaRef}
                popupRef={popupRef}
                positionerRef={positionerRef}
                itemRef={itemRef}
            />,
        );

        expect(areaRef.current).toBe(
            container.querySelector("[data-base-ui-selection-area]"),
        );

        selectText(container.querySelector("p")!);
        dispatchSelectionChange();
        await waitForSettle();

        const toolbar = getToolbar("Test toolbar");
        expect(toolbar).not.toBeNull();
        expect(popupRef.current?.getAttribute("role")).toBe("toolbar");
        expect(popupRef.current?.getAttribute("aria-label")).toBe(
            "Test toolbar",
        );
        expect(popupRef.current?.textContent).toContain("Bold");
        expect(positionerRef.current?.contains(popupRef.current)).toBe(true);
        expect(itemRef.current?.textContent).toBe("Bold");
        expect(itemRef.current?.getAttribute("data-base-ui-selection-item")).toBe(
            "",
        );
    });

    test("runs a callback ref cleanup when the area unmounts", () => {
        const events: string[] = [];
        const container = render(
            <Selection.Root label="Test toolbar">
                <Selection.Area
                    ref={() => {
                        events.push("attach");
                        return () => {
                            events.push("cleanup");
                        };
                    }}
                >
                    <p>Hello world</p>
                </Selection.Area>
            </Selection.Root>,
        );

        expect(
            container.querySelector("[data-base-ui-selection-area]"),
        ).not.toBeNull();
        expect(events).toEqual(["attach"]);

        cleanup();
        expect(events).toEqual(["attach", "cleanup"]);
    });
});
