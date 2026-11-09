import * as React from "react";
import * as Selection from "../../../src/selection";

function SelectionStatus({ label }: { label: string }) {
    const { selection, open } = Selection.useSelectionState();

    return (
        <p className="pg-selection-status" aria-live="off">
            <span className="pg-selection-status-label">{label}</span>
            <span>{open ? "open" : "closed"}</span>
            <span className="pg-selection-status-text">
                {selection
                    ? `${selection.text.length} selected`
                    : "no selection"}
            </span>
        </p>
    );
}

function Action({
    command,
    children,
}: {
    command: string;
    children: React.ReactNode;
}) {
    const selection = Selection.useSelection();

    return (
        <Selection.Item
            className="pg-selection-item"
            onClick={() => {
                selection.restore();
                document.execCommand(command);
            }}
        >
            {children}
        </Selection.Item>
    );
}

function CopyAction() {
    const selection = Selection.useSelection();

    return (
        <Selection.Item
            className="pg-selection-item"
            onClick={() => {
                selection.restore();
                document.execCommand("copy");
            }}
        >
            Copy
        </Selection.Item>
    );
}

function EditorToolbar() {
    return (
        <Selection.Portal>
            <Selection.Positioner className="pg-selection-positioner">
                <Selection.Popup className="pg-selection-popup">
                    <Selection.Arrow className="pg-selection-arrow" />
                    <Selection.Viewport className="pg-selection-viewport">
                        <Action command="bold">Bold</Action>
                        <Action command="italic">Italic</Action>
                        <Action command="underline">Underline</Action>
                        <Selection.Separator className="pg-selection-separator" />
                        <CopyAction />
                        <span className="pg-selection-hint">Alt+F10</span>
                    </Selection.Viewport>
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function StaticToolbar() {
    return (
        <Selection.Portal>
            <Selection.Positioner className="pg-selection-positioner">
                <Selection.Popup className="pg-selection-popup">
                    <Selection.Arrow className="pg-selection-arrow" />
                    <Selection.Viewport className="pg-selection-viewport">
                        <CopyAction />
                        <Selection.Item
                            className="pg-selection-item"
                            closeOnClick={false}
                            onClick={(event) => {
                                const button = event.currentTarget;
                                button.dataset.pressed = "true";
                                window.setTimeout(() => {
                                    delete button.dataset.pressed;
                                }, 600);
                            }}
                        >
                            Stay open
                        </Selection.Item>
                    </Selection.Viewport>
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function NestedBoldAction() {
    const selection = Selection.useSelection();

    return (
        <Selection.Item
            className="pg-selection-item"
            onClick={() => {
                selection.restore();
                document.execCommand("bold");
            }}
        >
            Bold inner
        </Selection.Item>
    );
}

function NestedToolbar() {
    return (
        <Selection.Portal>
            <Selection.Positioner className="pg-selection-positioner">
                <Selection.Popup className="pg-selection-popup">
                    <Selection.Arrow className="pg-selection-arrow" />
                    <Selection.Viewport className="pg-selection-viewport">
                        <NestedBoldAction />
                    </Selection.Viewport>
                </Selection.Popup>
            </Selection.Positioner>
        </Selection.Portal>
    );
}

function EditorDemo() {
    return (
        <Selection.Root label="Text formatting">
            <Selection.Area className="pg-area">
                <div
                    className="pg-editor"
                    contentEditable
                    suppressContentEditableWarning
                >
                    <p>
                        Select any part of this editable paragraph. The toolbar
                        opens above the first visible line and keeps the
                        selection when you press an action.
                    </p>
                    <p>
                        This second paragraph exists to test long, wrapped
                        selections across several lines and to test that the
                        toolbar follows a selection that extends below the fold
                        when the page scrolls.
                    </p>
                    <p>
                        Use Alt+F10 to move focus into the toolbar, then use the
                        arrow keys. Escape returns focus and the selection to
                        this editor.
                    </p>
                </div>
            </Selection.Area>
            <SelectionStatus label="Editor" />
            <EditorToolbar />
        </Selection.Root>
    );
}

function StaticDemo() {
    return (
        <Selection.Root label="Static article actions">
            <Selection.Area className="pg-area">
                <article className="pg-article">
                    <h2>A static article with selectable text</h2>
                    <p>
                        The same toolbar works on ordinary text. Selections made
                        with the keyboard use the same settle delay as
                        selections made with a pointer. A selection that starts
                        in one area and ends in another opens no toolbar at all.
                    </p>
                    <p>
                        The project keeps selection, focus, dismissal and
                        positioning in one headless component. The playground
                        supplies every visual style, including the popup
                        transition.
                    </p>
                </article>
            </Selection.Area>
            <SelectionStatus label="Static" />
            <StaticToolbar />
        </Selection.Root>
    );
}

function NestedDemo() {
    return (
        <Selection.Root label="Outer selection">
            <Selection.Area className="pg-area pg-nested-outer">
                <p>
                    Select this outer text. The outer toolbar opens with the
                    label “Outer selection”.
                </p>
                <Selection.Root label="Inner selection">
                    <Selection.Area className="pg-area pg-nested-inner">
                        <p>
                            Select this inner text. Only the inner toolbar
                            opens, because both selection endpoints belong to
                            the innermost area.
                        </p>
                    </Selection.Area>
                    <SelectionStatus label="Inner" />
                    <NestedToolbar />
                </Selection.Root>
                <p>
                    A selection that crosses the inner boundary must not open
                    either toolbar.
                </p>
            </Selection.Area>
            <SelectionStatus label="Outer" />
            <StaticToolbar />
        </Selection.Root>
    );
}

export function App() {
    return (
        <>
            <header className="pg-header">
                <h1 className="pg-title">
                    <a href="https://github.com/gilsmt/base-ui-selection">
                        base-ui-selection
                    </a>
                </h1>
                <span className="pg-tag">playground</span>
                <a
                    className="pg-header-link"
                    href="https://github.com/gilsmt/base-ui-selection#readme"
                >
                    Documentation
                </a>
            </header>
            <div className="pg-body">
                <nav className="pg-nav" aria-label="Demos">
                    <ul className="pg-nav-list">
                        <li>
                            <a className="pg-nav-button" href="#editor">
                                <span className="pg-nav-label">
                                    Contenteditable
                                </span>
                                <span className="pg-nav-description">
                                    Rich text actions
                                </span>
                            </a>
                        </li>
                        <li>
                            <a className="pg-nav-button" href="#static">
                                <span className="pg-nav-label">
                                    Static text
                                </span>
                                <span className="pg-nav-description">
                                    Read-only article
                                </span>
                            </a>
                        </li>
                        <li>
                            <a className="pg-nav-button" href="#nested">
                                <span className="pg-nav-label">
                                    Nested areas
                                </span>
                                <span className="pg-nav-description">
                                    Innermost area wins
                                </span>
                            </a>
                        </li>
                    </ul>
                </nav>
                <main className="pg-main">
                    <section id="editor" className="pg-section">
                        <h2 className="pg-section-title">Contenteditable</h2>
                        <p className="pg-section-description">
                            Actions restore the editor focus before they run.
                        </p>
                        <EditorDemo />
                    </section>
                    <section id="static" className="pg-section">
                        <h2 className="pg-section-title">Static text</h2>
                        <p className="pg-section-description">
                            The toolbar stays available on read-only content.
                        </p>
                        <StaticDemo />
                    </section>
                    <section id="nested" className="pg-section">
                        <h2 className="pg-section-title">Nested areas</h2>
                        <p className="pg-section-description">
                            Selections across boundaries open no toolbar.
                        </p>
                        <NestedDemo />
                    </section>
                </main>
            </div>
        </>
    );
}
