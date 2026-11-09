import * as React from "react";
import { createRoot } from "react-dom/client";
import {
    Selection,
    useSelection,
    useSelectionState,
    type SelectionChangeReason,
} from "../../../src/selection";
import "./styles.css";

interface SelectionEvent {
    label: string;
    open: boolean;
    reason: SelectionChangeReason;
}

declare global {
    interface Window {
        __selectionEvents: SelectionEvent[];
    }
}

window.__selectionEvents = [];

function recordEvent(
    label: string,
    open: boolean,
    reason: SelectionChangeReason,
): void {
    window.__selectionEvents.push({ label, open, reason });
}

function SelectionStatus({
    testId,
    reason,
}: {
    testId: string;
    reason: SelectionChangeReason;
}) {
    const { open, selection } = useSelectionState();
    return (
        <output
            className="status"
            data-testid={testId}
            data-open={open ? "true" : "false"}
            data-reason={reason}
            data-length={selection?.text.length ?? 0}
        >
            {open ? "open" : "closed"}
            {selection ? `: ${selection.text}` : ""}
        </output>
    );
}

function FormatItem({
    command,
    children,
}: {
    command: string;
    children: React.ReactNode;
}) {
    const selection = useSelection();

    return (
        <Selection.Item
            className="item"
            data-testid={`item-${command}`}
            onClick={() => {
                selection.restore();
                document.execCommand(command);
            }}
        >
            {children}
        </Selection.Item>
    );
}

function EditorToolbar({ withArrow = true }: { withArrow?: boolean }) {
    return (
        <Selection.Portal>
            <Selection.Positioner>
                <Selection.Popup className="popup" data-testid="editor-popup">
                    {withArrow ? <Selection.Arrow className="arrow" /> : null}
                    <Selection.Viewport className="viewport">
                        <FormatItem command="bold">Bold</FormatItem>
                        <FormatItem command="italic">Italic</FormatItem>
                        <Selection.Separator className="separator" />
                        <Selection.Item
                            className="item"
                            data-testid="item-stay"
                            closeOnClick={false}
                        >
                            Stay
                        </Selection.Item>
                    </Selection.Viewport>
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function StaticToolbar() {
    return (
        <Selection.Portal>
            <Selection.Positioner>
                <Selection.Popup className="popup" data-testid="static-popup">
                    <Selection.Viewport className="viewport">
                        <Selection.Item
                            className="item"
                            data-testid="static-stay"
                            closeOnClick={false}
                        >
                            Stay open
                        </Selection.Item>
                        <Selection.Item
                            className="item"
                            data-testid="static-close"
                        >
                            Close
                        </Selection.Item>
                    </Selection.Viewport>
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function GenericToolbar({ testId }: { testId: string }) {
    return (
        <Selection.Portal>
            <Selection.Positioner>
                <Selection.Popup className="popup" data-testid={testId}>
                    <Selection.Viewport className="viewport">
                        <Selection.Item className="item">Action</Selection.Item>
                    </Selection.Viewport>
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function EditorScene() {
    const [reason, setReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene">
            <Selection.Root
                label="Editor actions"
                onOpenChange={(open, nextReason) => {
                    setReason(nextReason);
                    recordEvent("Editor actions", open, nextReason);
                }}
            >
                <Selection.Area className="area" data-testid="editor-area">
                    <div
                        className="editor"
                        contentEditable
                        suppressContentEditableWarning
                        data-testid="editor"
                    >
                        <p data-testid="editor-p1">
                            Alpha bravo charlie delta echo foxtrot golf hotel
                            india juliet kilo lima mike november oscar papa
                            quebec romeo sierra tango. This paragraph wraps over
                            several lines so the toolbar can anchor to the first
                            visible line.
                        </p>
                        <p data-testid="editor-p2">
                            Uniform victor whiskey x-ray yankee zulu. A second
                            paragraph gives multi-line selections room to grow
                            below the first line.
                        </p>
                    </div>
                </Selection.Area>
                <SelectionStatus testId="editor-status" reason={reason} />
                <EditorToolbar />
            </Selection.Root>
            <button type="button" data-testid="outside-button">
                Outside
            </button>
        </div>
    );
}

function StaticScene() {
    const [reason, setReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene">
            <Selection.Root
                label="Static actions"
                onOpenChange={(open, nextReason) => {
                    setReason(nextReason);
                    recordEvent("Static actions", open, nextReason);
                }}
            >
                <Selection.Area className="area" data-testid="static-area">
                    <article className="article">
                        <h2>Static article</h2>
                        <p data-testid="static-p">
                            The same toolbar works on ordinary text. A selection
                            made with the keyboard uses the same settle delay as
                            a selection made with a pointer.
                        </p>
                    </article>
                </Selection.Area>
                <SelectionStatus testId="static-status" reason={reason} />
                <StaticToolbar />
            </Selection.Root>
        </div>
    );
}

function NestedScene() {
    const [outerReason, setOuterReason] =
        React.useState<SelectionChangeReason>("none");
    const [innerReason, setInnerReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene">
            <Selection.Root
                label="Outer actions"
                onOpenChange={(open, reason) => {
                    setOuterReason(reason);
                    recordEvent("Outer actions", open, reason);
                }}
            >
                <Selection.Area
                    className="area nested-outer"
                    data-testid="outer-area"
                >
                    <p data-testid="outer-p">
                        Outer text before the nested area.
                    </p>
                    <Selection.Root
                        label="Inner actions"
                        onOpenChange={(open, reason) => {
                            setInnerReason(reason);
                            recordEvent("Inner actions", open, reason);
                        }}
                    >
                        <Selection.Area
                            className="area nested-inner"
                            data-testid="inner-area"
                        >
                            <p data-testid="inner-p">
                                Inner text belongs to the innermost area.
                            </p>
                        </Selection.Area>
                        <SelectionStatus
                            testId="inner-status"
                            reason={innerReason}
                        />
                        <GenericToolbar testId="inner-popup" />
                    </Selection.Root>
                    <p data-testid="outer-after">
                        Outer text after the nested area.
                    </p>
                </Selection.Area>
                <SelectionStatus testId="outer-status" reason={outerReason} />
                <GenericToolbar testId="outer-popup" />
            </Selection.Root>
        </div>
    );
}

function ControlledScene() {
    const [open, setOpen] = React.useState(true);
    const [reason, setReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene">
            <div className="controls">
                <button
                    type="button"
                    data-testid="controlled-close"
                    onClick={() => {
                        setOpen(false);
                    }}
                >
                    Request close
                </button>
                <button
                    type="button"
                    data-testid="controlled-open"
                    onClick={() => {
                        setOpen(true);
                    }}
                >
                    Request open
                </button>
                <span className="status" data-testid="controlled-prop">
                    {open ? "parent open" : "parent closed"}
                </span>
            </div>
            <Selection.Root
                label="Controlled actions"
                open={open}
                onOpenChange={(nextOpen, nextReason) => {
                    setReason(nextReason);
                    recordEvent("Controlled actions", nextOpen, nextReason);
                }}
            >
                <Selection.Area className="area" data-testid="controlled-area">
                    <p data-testid="controlled-p">
                        Controlled selections consume a close request without
                        clearing the parent state.
                    </p>
                </Selection.Area>
                <SelectionStatus testId="controlled-status" reason={reason} />
                <Selection.Portal>
                    <Selection.Positioner>
                        <Selection.Popup
                            className="popup"
                            data-testid="controlled-popup"
                        >
                            <Selection.Viewport className="viewport">
                                <Selection.Item
                                    className="item"
                                    data-testid="controlled-item"
                                >
                                    Close item
                                </Selection.Item>
                            </Selection.Viewport>
                        </Selection.Popup>
                    </Selection.Positioner>
                </Selection.Portal>
            </Selection.Root>
        </div>
    );
}

function ManualScene() {
    const [reason, setReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene">
            <Selection.Root
                label="Manual actions"
                autoOpen={false}
                onOpenChange={(open, nextReason) => {
                    setReason(nextReason);
                    recordEvent("Manual actions", open, nextReason);
                }}
            >
                <Selection.Area className="area" data-testid="manual-area">
                    <p data-testid="manual-p">
                        Manual selections wait for the focus shortcut.
                    </p>
                </Selection.Area>
                <SelectionStatus testId="manual-status" reason={reason} />
                <GenericToolbar testId="manual-popup" />
            </Selection.Root>
        </div>
    );
}

function NoShortcutScene() {
    const [reason, setReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene">
            <Selection.Root
                label="No shortcut actions"
                focusShortcut={false}
                onOpenChange={(open, nextReason) => {
                    setReason(nextReason);
                    recordEvent("No shortcut actions", open, nextReason);
                }}
            >
                <Selection.Area className="area" data-testid="no-shortcut-area">
                    <p data-testid="no-shortcut-p">
                        This toolbar has no keyboard focus shortcut.
                    </p>
                </Selection.Area>
                <SelectionStatus
                    testId="no-shortcut-status"
                    reason={reason}
                />
                <GenericToolbar testId="no-shortcut-popup" />
            </Selection.Root>
        </div>
    );
}

function GeometryScene() {
    const params = new URLSearchParams(window.location.search);
    const top = Number(params.get("top") ?? "240");
    const left = Number(params.get("left") ?? "24");
    const width = Number(params.get("width") ?? "420");
    const popupHeight = Number(params.get("height") ?? "40");
    const align =
        params.get("align") === "right"
            ? "right"
            : params.get("align") === "center"
              ? "center"
              : "left";
    const text =
        params.get("text") ??
        "Geometry selection text that wraps across more than one line when the container is narrow enough to break it.";
    const [reason, setReason] =
        React.useState<SelectionChangeReason>("none");

    return (
        <div className="scene geometry-scene">
            <div
                className="geometry-box"
                style={{ marginTop: top, marginLeft: left, width }}
            >
                <Selection.Root
                    label="Geometry actions"
                    onOpenChange={(open, nextReason) => {
                        setReason(nextReason);
                        recordEvent("Geometry actions", open, nextReason);
                    }}
                >
                    <Selection.Area
                        className="area"
                        data-testid="geometry-area"
                    >
                        <p
                            data-testid="geometry-p"
                            style={{ textAlign: align }}
                        >
                            {text}
                        </p>
                    </Selection.Area>
                    <SelectionStatus
                        testId="geometry-status"
                        reason={reason}
                    />
                    <Selection.Portal>
                        <Selection.Positioner>
                            <Selection.Popup
                                className="popup"
                                data-testid="geometry-popup"
                                style={{ height: popupHeight }}
                            >
                                <Selection.Viewport className="viewport">
                                    <Selection.Item className="item">
                                        Action
                                    </Selection.Item>
                                    <Selection.Item className="item">
                                        Second
                                    </Selection.Item>
                                </Selection.Viewport>
                            </Selection.Popup>
                        </Selection.Positioner>
                    </Selection.Portal>
                </Selection.Root>
            </div>
        </div>
    );
}

const SCENES: Record<string, React.ComponentType> = {
    editor: EditorScene,
    static: StaticScene,
    nested: NestedScene,
    controlled: ControlledScene,
    manual: ManualScene,
    "no-shortcut": NoShortcutScene,
    geometry: GeometryScene,
};

function App() {
    const scene =
        new URLSearchParams(window.location.search).get("scene") ?? "editor";
    const Scene = SCENES[scene];
    if (!Scene) {
        throw new Error(`Unknown fixture scene: ${scene}`);
    }
    return <Scene />;
}

const root = document.getElementById("root");
if (!root) {
    throw new Error("Missing fixture root element.");
}

createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
);
