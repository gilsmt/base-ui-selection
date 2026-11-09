"use client";

import * as React from "react";
import { Toolbar } from "@base-ui/react/toolbar";
import { Popover } from "@base-ui/react/popover";
import { addEventListener } from "@base-ui/utils/addEventListener";
import { isElementDisabled } from "@base-ui/utils/isElementDisabled";
import { mergeCleanups } from "@base-ui/utils/mergeCleanups";
import { useAnimationFrame } from "@base-ui/utils/useAnimationFrame";
import { useIsoLayoutEffect } from "@base-ui/utils/useIsoLayoutEffect";
import { useMergedRefs } from "@base-ui/utils/useMergedRefs";
import { useStableCallback } from "@base-ui/utils/useStableCallback";
import { useTimeout } from "@base-ui/utils/useTimeout";
import { useValueAsRef } from "@base-ui/utils/useValueAsRef";
import { visuallyHidden } from "@base-ui/utils/visuallyHidden";

const SETTLE_DELAY_MS = 150;

const DEFAULT_SIDE_OFFSET = 8;
const DEFAULT_COLLISION_PADDING = 8;
const DEFAULT_ARROW_PADDING = 5;
const DEFAULT_FOCUS_SHORTCUT = "Alt+F10";

const AREA_ATTRIBUTE = "data-base-ui-selection-area";
const ITEM_ATTRIBUTE = "data-base-ui-selection-item";

const AREA_SELECTOR = `[${AREA_ATTRIBUTE}]`;
const ITEM_SELECTOR = `[${ITEM_ATTRIBUTE}]`;

export type SelectionChangeReason =
    | "auto-open"
    | "outside-press"
    | "escape-key"
    | "tab-out"
    | "focus-out"
    | "close-press"
    | "selection-clear"
    | "collision"
    | "none";

export interface SelectionData {
    /**
     * The current DOM range.
     */
    range: Range;
    /**
     * The selected text.
     */
    text: string;
    /**
     * The client rectangles of the selection, one per text fragment.
     */
    rects: readonly DOMRect[];
    /**
     * The bounding client rectangle of the selection.
     */
    boundingRect: DOMRect;
}

export interface SelectionValue extends SelectionData {
    /**
     * Restores focus and the saved range. Call this before an action that needs
     * the editor to be focused.
     */
    restore: () => void;
}

export interface SelectionState {
    /**
     * The active selection. It is `null` when no valid selection exists.
     */
    selection: SelectionData | null;
    /**
     * Whether the toolbar is open.
     */
    open: boolean;
}

export interface SelectionRootProps {
    children?: React.ReactNode;
    /**
     * Whether the toolbar is open.
     *
     * This is a controlled open request. A dismissal closes the toolbar even
     * while `open` stays `true`. A new selection or a change from `false` to
     * `true` makes the request active again.
     */
    open?: boolean | undefined;
    /**
     * Whether the toolbar is initially open.
     * @default false
     */
    defaultOpen?: boolean | undefined;
    /**
     * Called when the toolbar opens or closes, with the reason for the change.
     */
    onOpenChange?:
        ((open: boolean, reason: SelectionChangeReason) => void) | undefined;
    /**
     * Whether a valid selection opens the toolbar automatically.
     * Touch-originated selections never open automatically.
     * @default true
     */
    autoOpen?: boolean | undefined;
    /**
     * The accessible name of the toolbar.
     */
    label: string;
    /**
     * Replaces the default live-region announcement.
     */
    announcement?: string | undefined;
    /**
     * Keyboard shortcut that moves focus to the first toolbar item.
     * Set to `false` to disable the shortcut.
     * @default "Alt+F10"
     */
    focusShortcut?: string | false | undefined;
}

export type SelectionAreaProps = Omit<
    React.ComponentPropsWithRef<"div">,
    "children"
> & {
    children?: React.ReactNode;
};

export type SelectionPortalProps = Omit<Popover.Portal.Props, "keepMounted">;

export interface SelectionCollisionPadding {
    top?: number | undefined;
    right?: number | undefined;
    bottom?: number | undefined;
    left?: number | undefined;
}

export interface SelectionPositionerProps {
    children?: React.ReactNode;
    ref?: React.Ref<HTMLDivElement> | undefined;
    /**
     * Distance between the selection and the toolbar.
     * @default 8
     */
    sideOffset?: number | undefined;
    /**
     * Space kept between the toolbar and the viewport edge.
     * @default 8
     */
    collisionPadding?: number | SelectionCollisionPadding | undefined;
    /**
     * Space kept between the arrow and the popup edge.
     * @default 5
     */
    arrowPadding?: number | undefined;
    className?: Popover.Positioner.Props["className"];
    style?: Popover.Positioner.Props["style"];
    render?: Popover.Positioner.Props["render"];
}

export type SelectionPopupProps = Omit<
    Popover.Popup.Props,
    | "initialFocus"
    | "finalFocus"
    | "role"
    | "aria-label"
    | "aria-keyshortcuts"
    | "render"
> & {
    /**
     * Replaces the toolbar element. The toolbar behavior stays on the element.
     */
    render?: Toolbar.Root.Props["render"];
};

export interface SelectionItemProps extends Toolbar.Button.Props {
    /**
     * Whether clicking the item closes the toolbar.
     * @default true
     */
    closeOnClick?: boolean | undefined;
}

export type SelectionSeparatorProps = Toolbar.Separator.Props;
export type SelectionArrowProps = Popover.Arrow.Props;
export type SelectionViewportProps = Popover.Viewport.Props;

interface SelectionSnapshot extends SelectionData {
    area: HTMLElement;
    focusOwner: HTMLElement | null;
}

type SelectionSide = "top" | "bottom";

interface SelectionRootContextValue {
    open: boolean;
    selection: SelectionSnapshot | null;
    hasSelection: boolean;
    announcement: string;
    label: string;
    focusShortcut: string | false;
    areaRef: React.RefObject<HTMLDivElement | null>;
    popupRef: React.RefObject<HTMLDivElement | null>;
    selectionValue: SelectionValue | null;
    dismiss: (reason: SelectionChangeReason) => void;
    requestOpen: (reason: SelectionChangeReason) => void;
    focusFirstItem: () => boolean;
    consumeFocusOnOpen: () => boolean;
    restoreSelection: () => void;
}

const SelectionRootContext =
    React.createContext<SelectionRootContextValue | null>(null);

function useSelectionRootContext(): SelectionRootContextValue {
    const context = React.useContext(SelectionRootContext);
    if (!context) {
        throw new Error(
            "Base UI Selection: this component must be used inside <Selection.Root>.",
        );
    }
    return context;
}

/**
 * Returns the selection that the open toolbar belongs to. The value stays
 * available while the popup exits.
 */
export function useSelection(): SelectionValue {
    const context = useSelectionRootContext();
    if (!context.selectionValue) {
        throw new Error(
            "Base UI Selection: useSelection() requires an active selection. Render it inside <Selection.Popup>.",
        );
    }
    return context.selectionValue;
}

/**
 * Returns the current selection and the open state. Use it at the root when a
 * part outside the popup needs to react to the selection.
 */
export function useSelectionState(): SelectionState {
    const context = useSelectionRootContext();
    return {
        selection: context.hasSelection ? context.selection : null,
        open: context.open,
    };
}

interface RectLike {
    x: number;
    y: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

interface SelectionAnchor {
    contextElement: Element;
    getBoundingClientRect: () => RectLike;
}

interface LineRect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

interface ViewportMetrics {
    top: number;
    bottom: number;
}

function getViewportMetrics(): ViewportMetrics {
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const height = viewport?.height ?? window.innerHeight;
    return { top, bottom: top + height };
}

function getElementForNode(node: Node): Element | null {
    if (node.nodeType === Node.ELEMENT_NODE) {
        return node as Element;
    }
    return node.parentElement;
}

function getClosestArea(node: Node): HTMLElement | null {
    const element = getElementForNode(node);
    return element?.closest<HTMLElement>(AREA_SELECTOR) ?? null;
}

function isNodeInFormControl(node: Node): boolean {
    const element = getElementForNode(node);
    return element?.closest("input, textarea, select") != null;
}

function isRangeConnected(range: Range): boolean {
    return range.startContainer.isConnected && range.endContainer.isConnected;
}

function getFocusOwner(range: Range, area: HTMLElement): HTMLElement | null {
    let element = getElementForNode(range.startContainer);
    while (element) {
        if (element instanceof HTMLElement && element.isContentEditable) {
            return element;
        }
        element = element.parentElement;
    }

    const active = document.activeElement;
    if (
        active instanceof HTMLElement &&
        (active === area || area.contains(active))
    ) {
        return active;
    }

    return area;
}

function readSelectionSnapshot(area: HTMLElement): SelectionSnapshot | null {
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return null;
    }

    const range = selection.getRangeAt(0).cloneRange();
    const text = selection.toString();
    if (text.trim().length === 0) {
        return null;
    }

    if (
        getClosestArea(range.startContainer) !== area ||
        getClosestArea(range.endContainer) !== area
    ) {
        return null;
    }

    if (
        isNodeInFormControl(range.startContainer) ||
        isNodeInFormControl(range.endContainer)
    ) {
        return null;
    }

    const rects: DOMRect[] = [];
    for (const rect of range.getClientRects()) {
        if (rect.height > 0) {
            rects.push(rect);
        }
    }

    const boundingRect = range.getBoundingClientRect();
    if (rects.length === 0 && boundingRect.height <= 0) {
        return null;
    }

    return {
        range,
        text,
        rects,
        boundingRect,
        area,
        focusOwner: getFocusOwner(range, area),
    };
}

function isSameSelection(
    snapshot: SelectionSnapshot | null,
    next: SelectionSnapshot,
): boolean {
    if (!snapshot || !isRangeConnected(snapshot.range)) {
        return false;
    }

    const previous = snapshot.range;
    const current = next.range;
    return (
        previous.startContainer === current.startContainer &&
        previous.startOffset === current.startOffset &&
        previous.endContainer === current.endContainer &&
        previous.endOffset === current.endOffset &&
        snapshot.text === next.text
    );
}

function isFocusInsidePopup(popup: HTMLElement | null): boolean {
    if (!popup) {
        return false;
    }
    const active = document.activeElement;
    return active != null && popup.contains(active);
}

function restoreSnapshot(
    snapshot: SelectionSnapshot,
    restoringRef: React.RefObject<boolean>,
): void {
    const selection = document.getSelection();
    if (!selection) {
        return;
    }

    const live = readSelectionSnapshot(snapshot.area);
    const source = live ?? snapshot;
    if (!isRangeConnected(source.range)) {
        return;
    }

    restoringRef.current = true;
    const owner = source.focusOwner;
    if (owner && owner.isConnected) {
        owner.focus({ preventScroll: true });
    }

    selection.removeAllRanges();
    selection.addRange(source.range.cloneRange());

    window.setTimeout(() => {
        restoringRef.current = false;
    }, 0);
}

function getLineRects(range: Range): LineRect[] {
    const rects: DOMRect[] = [];
    for (const rect of range.getClientRects()) {
        if (rect.height > 0) {
            rects.push(rect);
        }
    }

    rects.sort((a, b) => a.top - b.top || a.left - b.left);

    const lines: LineRect[] = [];
    let previousTop = 0;
    let previousHeight = 0;

    for (const rect of rects) {
        const line = lines[lines.length - 1];
        if (!line || rect.top - previousTop > previousHeight / 2) {
            lines.push({
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
            });
        } else {
            line.left = Math.min(line.left, rect.left);
            line.top = Math.min(line.top, rect.top);
            line.right = Math.max(line.right, rect.right);
            line.bottom = Math.max(line.bottom, rect.bottom);
        }
        previousTop = rect.top;
        previousHeight = rect.height;
    }

    lines.sort((a, b) => a.top - b.top);
    return lines;
}

function getVisibleLineRects(
    range: Range,
    viewport: ViewportMetrics,
): LineRect[] {
    const lines = getLineRects(range);
    const visible: LineRect[] = [];

    for (const line of lines) {
        if (line.bottom > viewport.top && line.top < viewport.bottom) {
            visible.push(line);
        }
    }

    return visible;
}

function createEmptyRect(): RectLike {
    return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
    };
}

function createAnchorRect(range: Range, side: SelectionSide): RectLike {
    const viewport = getViewportMetrics();
    const lines = getVisibleLineRects(range, viewport);
    if (lines.length === 0) {
        return createEmptyRect();
    }

    const first = lines[0];
    const last = lines[lines.length - 1];
    const target = side === "top" ? first : last;
    const centerX = (target.left + target.right) / 2;

    return {
        x: centerX,
        y: first.top,
        left: centerX,
        top: first.top,
        right: centerX,
        bottom: last.bottom,
        width: 0,
        height: last.bottom - first.top,
    };
}

function createVirtualAnchor(
    range: Range,
    area: HTMLElement,
    side: SelectionSide,
): SelectionAnchor {
    return {
        contextElement: area,
        getBoundingClientRect() {
            return createAnchorRect(range, side);
        },
    };
}

function getPaddingSide(
    padding: number | SelectionCollisionPadding,
    side: "top" | "bottom",
): number {
    if (typeof padding === "number") {
        return padding;
    }
    return padding[side] ?? 0;
}

function getDesiredSide(
    range: Range,
    popupHeight: number,
    sideOffset: number,
    paddingTop: number,
    paddingBottom: number,
): SelectionSide | null {
    const viewport = getViewportMetrics();
    const lines = getVisibleLineRects(range, viewport);
    if (lines.length === 0) {
        return null;
    }

    const first = lines[0];
    const last = lines[lines.length - 1];
    const spaceAbove = first.top - viewport.top - paddingTop;
    const spaceBelow = viewport.bottom - last.bottom - paddingBottom;

    if (popupHeight + sideOffset <= spaceAbove) {
        return "top";
    }
    if (popupHeight + sideOffset <= spaceBelow) {
        return "bottom";
    }
    return null;
}

function getPopupHeight(popup: HTMLElement): number {
    return popup.offsetHeight || popup.scrollHeight;
}

function createDefaultAnnouncement(
    label: string,
    focusShortcut: string | false,
): string {
    if (!focusShortcut) {
        return `${label} available.`;
    }
    return `${label} available. Press ${focusShortcut} to focus the toolbar.`;
}

type ShortcutModifier = "alt" | "ctrl" | "meta" | "shift";

interface ParsedShortcut {
    alt: boolean;
    ctrl: boolean;
    meta: boolean;
    shift: boolean;
    key: string;
}

const SHORTCUT_MODIFIER_ALIASES: Record<string, ShortcutModifier> = {
    alt: "alt",
    option: "alt",
    control: "ctrl",
    ctrl: "ctrl",
    meta: "meta",
    cmd: "meta",
    command: "meta",
    shift: "shift",
};

const ARIA_KEY_NAMES: Record<string, string> = {
    " ": "Space",
    escape: "Escape",
    arrowleft: "ArrowLeft",
    arrowright: "ArrowRight",
    arrowup: "ArrowUp",
    arrowdown: "ArrowDown",
    pageup: "PageUp",
    pagedown: "PageDown",
    home: "Home",
    end: "End",
    insert: "Insert",
    delete: "Delete",
    backspace: "Backspace",
    enter: "Enter",
    tab: "Tab",
};

function normalizeShortcutKey(key: string): string | null {
    if (key.length === 0) {
        return null;
    }
    if (key === " ") {
        return " ";
    }

    const lower = key.toLowerCase();
    if (lower === "space" || lower === "spacebar") {
        return " ";
    }
    if (lower === "esc") {
        return "escape";
    }
    if (lower === "del") {
        return "delete";
    }
    return lower;
}

function isShortcutModifier(value: string): boolean {
    return SHORTCUT_MODIFIER_ALIASES[value.toLowerCase()] != null;
}

function parseShortcut(shortcut: string): ParsedShortcut | null {
    const rawParts = shortcut.split("+");
    const parts: string[] = [];

    for (const part of rawParts) {
        const trimmed = part.trim();
        if (trimmed.length > 0) {
            parts.push(trimmed);
        }
    }
    if (parts.length === 0) {
        return null;
    }

    const keyPart = parts.pop();
    if (!keyPart || isShortcutModifier(keyPart)) {
        return null;
    }

    const key = normalizeShortcutKey(keyPart);
    if (!key) {
        return null;
    }

    const parsed: ParsedShortcut = {
        alt: false,
        ctrl: false,
        meta: false,
        shift: false,
        key,
    };

    for (const part of parts) {
        const modifier = SHORTCUT_MODIFIER_ALIASES[part.toLowerCase()];
        if (!modifier) {
            return null;
        }
        parsed[modifier] = true;
    }

    return parsed;
}

function matchesShortcut(
    event: KeyboardEvent,
    shortcut: ParsedShortcut,
): boolean {
    if (
        event.altKey !== shortcut.alt ||
        event.ctrlKey !== shortcut.ctrl ||
        event.metaKey !== shortcut.meta ||
        event.shiftKey !== shortcut.shift
    ) {
        return false;
    }

    const key = normalizeShortcutKey(event.key);
    if (key === shortcut.key) {
        return true;
    }

    if (shortcut.key.length === 1) {
        if (event.code.startsWith("Key")) {
            return event.code.slice(3).toLowerCase() === shortcut.key;
        }
        if (event.code.startsWith("Digit")) {
            return event.code.slice(5) === shortcut.key;
        }
    }

    return event.code.toLowerCase() === shortcut.key;
}

function toAriaKeyName(key: string): string {
    const named = ARIA_KEY_NAMES[key];
    if (named) {
        return named;
    }
    if (key.length === 1) {
        return key.toUpperCase();
    }
    if (key.startsWith("f") && key.length <= 3) {
        return key.toUpperCase();
    }
    return key.charAt(0).toUpperCase() + key.slice(1);
}

function toAriaShortcut(shortcut: string): string | undefined {
    const parsed = parseShortcut(shortcut);
    if (!parsed) {
        return undefined;
    }

    const parts: string[] = [];
    if (parsed.ctrl) {
        parts.push("Control");
    }
    if (parsed.alt) {
        parts.push("Alt");
    }
    if (parsed.meta) {
        parts.push("Meta");
    }
    if (parsed.shift) {
        parts.push("Shift");
    }
    parts.push(toAriaKeyName(parsed.key));
    return parts.join("+");
}

function isSelectionGestureKey(event: KeyboardEvent): boolean {
    switch (event.key) {
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown":
        case "Home":
        case "End":
        case "PageUp":
        case "PageDown":
            return event.shiftKey;
        case "a":
        case "A":
            return event.ctrlKey || event.metaKey;
        default:
            return false;
    }
}

function isSelectionInArea(area: HTMLElement): boolean {
    const active = document.activeElement;
    if (active != null && area.contains(active)) {
        return true;
    }

    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return false;
    }

    const range = selection.getRangeAt(0);
    return (
        getClosestArea(range.startContainer) === area &&
        getClosestArea(range.endContainer) === area
    );
}

function mapBaseUiReason(reason: string): SelectionChangeReason {
    switch (reason) {
        case "outside-press":
            return "outside-press";
        case "escape-key":
            return "escape-key";
        case "focus-out":
            return "focus-out";
        case "close-press":
            return "close-press";
        default:
            return "none";
    }
}

export function Root(props: SelectionRootProps): React.JSX.Element {
    const {
        children,
        open: openProp,
        defaultOpen = false,
        onOpenChange,
        autoOpen = true,
        label,
        announcement,
        focusShortcut = DEFAULT_FOCUS_SHORTCUT,
    } = props;

    const areaRef = React.useRef<HTMLDivElement | null>(null);
    const popupRef = React.useRef<HTMLDivElement | null>(null);

    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const [dismissed, setDismissed] = React.useState(false);
    const [snapshot, setSnapshot] = React.useState<SelectionSnapshot | null>(
        null,
    );
    const [isSelectionCurrent, setIsSelectionCurrent] = React.useState(false);

    const snapshotRef = React.useRef<SelectionSnapshot | null>(null);
    const selectionCurrentRef = React.useRef(false);
    const internalOpenRef = React.useRef(defaultOpen);
    const dismissedRef = React.useRef(false);
    const restoringRef = React.useRef(false);
    const focusOnOpenRef = React.useRef(false);
    const pointerSelectingRef = React.useRef(false);
    const gestureStartedRef = React.useRef(false);
    const suppressAutoOpenRef = React.useRef(false);
    const outsidePointerDownRef = React.useRef(false);
    const settleTimeout = useTimeout();

    const resolvedFocusShortcut = React.useMemo(() => {
        if (focusShortcut === false) {
            return false;
        }
        return parseShortcut(focusShortcut) ? focusShortcut : false;
    }, [focusShortcut]);

    const parsedShortcut = React.useMemo(
        () =>
            resolvedFocusShortcut === false
                ? null
                : parseShortcut(resolvedFocusShortcut),
        [resolvedFocusShortcut],
    );
    const parsedShortcutRef = useValueAsRef(parsedShortcut);

    const notifyOpenChange = useStableCallback(
        (nextOpen: boolean, reason: SelectionChangeReason) => {
            onOpenChange?.(nextOpen, reason);
        },
    );

    const commitSnapshot = React.useCallback(
        (next: SelectionSnapshot | null) => {
            snapshotRef.current = next;
            setSnapshot(next);
        },
        [],
    );

    const commitSelectionCurrent = React.useCallback((next: boolean) => {
        selectionCurrentRef.current = next;
        setIsSelectionCurrent(next);
    }, []);

    const getIsOpen = useStableCallback(() => {
        const requested = openProp ?? internalOpenRef.current;
        return (
            requested &&
            !dismissedRef.current &&
            selectionCurrentRef.current &&
            snapshotRef.current !== null
        );
    });

    const restoreSelection = React.useCallback(() => {
        const current = snapshotRef.current;
        if (!current) {
            return;
        }

        restoreSnapshot(current, restoringRef);

        const restored = readSelectionSnapshot(current.area);
        if (!restored) {
            return;
        }
        commitSnapshot(restored);
        if (!selectionCurrentRef.current) {
            commitSelectionCurrent(true);
        }
    }, [commitSelectionCurrent, commitSnapshot]);

    const focusFirstItem = React.useCallback(() => {
        const popup = popupRef.current;
        if (!popup) {
            return false;
        }

        const items = popup.querySelectorAll<HTMLElement>(ITEM_SELECTOR);
        for (const item of items) {
            if (isElementDisabled(item) || item.hidden) {
                continue;
            }
            item.focus({ preventScroll: true });
            return true;
        }
        return false;
    }, []);

    const consumeFocusOnOpen = React.useCallback(() => {
        const pending = focusOnOpenRef.current;
        focusOnOpenRef.current = false;
        return pending;
    }, []);

    const dismiss = useStableCallback((reason: SelectionChangeReason) => {
        if (dismissedRef.current || !getIsOpen()) {
            return;
        }

        dismissedRef.current = true;
        setDismissed(true);

        if (openProp === undefined) {
            internalOpenRef.current = false;
            setInternalOpen(false);
        }

        if (
            reason === "escape-key" ||
            reason === "tab-out" ||
            reason === "close-press"
        ) {
            restoreSelection();
        }

        notifyOpenChange(false, reason);
    });

    const requestOpen = useStableCallback((reason: SelectionChangeReason) => {
        if (!snapshotRef.current || !selectionCurrentRef.current) {
            return;
        }

        const wasOpen = getIsOpen();

        if (dismissedRef.current) {
            dismissedRef.current = false;
            setDismissed(false);
        }

        if (openProp === undefined && !internalOpenRef.current) {
            internalOpenRef.current = true;
            setInternalOpen(true);
        }

        if (!wasOpen) {
            notifyOpenChange(true, reason);
        }
    });

    const settleSelection = useStableCallback(() => {
        if (restoringRef.current) {
            return;
        }

        // The touch guard belongs to one settled gesture. Consume it even when
        // this pass opens nothing, so a later programmatic selection can open.
        const suppressAutoOpen = suppressAutoOpenRef.current;
        suppressAutoOpenRef.current = false;

        const area = areaRef.current;
        if (!area) {
            return;
        }

        if (isFocusInsidePopup(popupRef.current)) {
            gestureStartedRef.current = false;
            return;
        }

        const next = readSelectionSnapshot(area);
        if (!next) {
            const wasOpen = getIsOpen();
            const wasCurrent = selectionCurrentRef.current;
            gestureStartedRef.current = false;

            if (wasOpen) {
                dismiss("selection-clear");
            }
            if (wasCurrent) {
                commitSelectionCurrent(false);
            }
            if (!wasOpen && !popupRef.current) {
                commitSnapshot(null);
            }
            return;
        }

        const changed =
            !isSameSelection(snapshotRef.current, next) ||
            !selectionCurrentRef.current;

        if (changed) {
            commitSnapshot(next);
        }
        if (!selectionCurrentRef.current) {
            commitSelectionCurrent(true);
        }

        const hadGesture = gestureStartedRef.current;
        gestureStartedRef.current = false;

        if (getIsOpen()) {
            return;
        }
        if (!autoOpen || suppressAutoOpen) {
            return;
        }
        if (!changed && !hadGesture) {
            return;
        }

        requestOpen("auto-open");
    });

    const scheduleSelectionSettle = React.useCallback(() => {
        settleTimeout.start(SETTLE_DELAY_MS, settleSelection);
    }, [settleSelection, settleTimeout]);

    const handlePopoverOpenChange = React.useCallback(
        (nextOpen: boolean, details: { reason: string }) => {
            if (nextOpen) {
                return;
            }

            const reason = mapBaseUiReason(details.reason);
            dismiss(
                reason === "focus-out" && outsidePointerDownRef.current
                    ? "outside-press"
                    : reason,
            );
        },
        [dismiss],
    );

    const handlePopoverOpenChangeComplete = React.useCallback(
        (nextOpen: boolean) => {
            if (nextOpen) {
                return;
            }
            if (!selectionCurrentRef.current) {
                commitSnapshot(null);
            }
        },
        [commitSnapshot],
    );

    const previousControlledOpenRef = React.useRef(openProp);
    React.useEffect(() => {
        const previous = previousControlledOpenRef.current;
        previousControlledOpenRef.current = openProp;

        if (previous === false && openProp === true && dismissedRef.current) {
            dismissedRef.current = false;
            setDismissed(false);
        }
    }, [openProp]);

    React.useEffect(() => {
        const handleSelectionChange = () => {
            if (restoringRef.current || pointerSelectingRef.current) {
                return;
            }
            scheduleSelectionSettle();
        };

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) {
                return;
            }

            const popup = popupRef.current;
            if (getIsOpen() && (!popup || !popup.contains(target))) {
                outsidePointerDownRef.current = true;
                window.setTimeout(() => {
                    outsidePointerDownRef.current = false;
                }, 0);
            }

            const area = areaRef.current;
            if (!area || !area.contains(target)) {
                return;
            }

            gestureStartedRef.current = true;
            pointerSelectingRef.current = true;
            settleTimeout.clear();

            if (event.pointerType === "touch") {
                suppressAutoOpenRef.current = true;
            } else {
                suppressAutoOpenRef.current = false;
            }
        };

        const handlePointerEnd = () => {
            if (!pointerSelectingRef.current) {
                return;
            }
            pointerSelectingRef.current = false;
            scheduleSelectionSettle();
        };

        const handleBlur = () => {
            if (!pointerSelectingRef.current) {
                return;
            }
            pointerSelectingRef.current = false;
            scheduleSelectionSettle();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (isSelectionGestureKey(event)) {
                gestureStartedRef.current = true;
                suppressAutoOpenRef.current = false;
                scheduleSelectionSettle();
            }

            if (event.repeat || event.defaultPrevented) {
                return;
            }

            const shortcut = parsedShortcutRef.current;
            const area = areaRef.current;
            if (!shortcut || !area || !isSelectionInArea(area)) {
                return;
            }
            if (!matchesShortcut(event, shortcut)) {
                return;
            }
            if (!snapshotRef.current || !selectionCurrentRef.current) {
                return;
            }

            if (!getIsOpen()) {
                focusOnOpenRef.current = true;
                requestOpen("none");
                event.preventDefault();
                return;
            }

            if (focusFirstItem()) {
                event.preventDefault();
            }
        };

        return mergeCleanups(
            addEventListener(
                document,
                "selectionchange",
                handleSelectionChange,
            ),
            addEventListener(document, "pointerdown", handlePointerDown, true),
            addEventListener(window, "pointerup", handlePointerEnd, true),
            addEventListener(window, "pointercancel", handlePointerEnd, true),
            addEventListener(window, "blur", handleBlur),
            addEventListener(document, "keydown", handleKeyDown),
            settleTimeout.clear,
        );
    }, [
        focusFirstItem,
        getIsOpen,
        requestOpen,
        scheduleSelectionSettle,
        settleTimeout,
    ]);

    const requestedOpen = openProp ?? internalOpen;
    const isOpen =
        requestedOpen && !dismissed && isSelectionCurrent && snapshot !== null;

    const selectionValue = React.useMemo<SelectionValue | null>(() => {
        if (!snapshot) {
            return null;
        }
        return {
            range: snapshot.range,
            text: snapshot.text,
            rects: snapshot.rects,
            boundingRect: snapshot.boundingRect,
            restore: restoreSelection,
        };
    }, [snapshot, restoreSelection]);

    const announcementText = isOpen
        ? (announcement ??
          createDefaultAnnouncement(label, resolvedFocusShortcut))
        : "";

    const contextValue: SelectionRootContextValue = {
        open: isOpen,
        selection: snapshot,
        hasSelection: isSelectionCurrent && snapshot !== null,
        announcement: announcementText,
        label,
        focusShortcut: resolvedFocusShortcut,
        areaRef,
        popupRef,
        selectionValue,
        dismiss,
        requestOpen,
        focusFirstItem,
        consumeFocusOnOpen,
        restoreSelection,
    };

    return (
        <SelectionRootContext.Provider value={contextValue}>
            <Popover.Root
                open={isOpen}
                modal={false}
                onOpenChange={handlePopoverOpenChange}
                onOpenChangeComplete={handlePopoverOpenChangeComplete}
            >
                {children}
            </Popover.Root>
        </SelectionRootContext.Provider>
    );
}

export function Area(props: SelectionAreaProps): React.JSX.Element {
    const { children, tabIndex, ref, ...elementProps } = props;
    const { areaRef, announcement } = useSelectionRootContext();

    const handleRef = useMergedRefs(areaRef, ref);

    return (
        <div
            {...elementProps}
            ref={handleRef}
            tabIndex={tabIndex ?? -1}
            data-base-ui-selection-area=""
        >
            {children}
            <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                contentEditable={false}
                suppressContentEditableWarning
                style={visuallyHidden}
            >
                {announcement}
            </span>
        </div>
    );
}

const COLLISION_AVOIDANCE = {
    side: "none",
    align: "shift",
    fallbackAxisSide: "none",
} as const;

const POSITIONER_LAYOUT_STYLE: React.CSSProperties = {
    width: "var(--positioner-width, auto)",
    height: "var(--positioner-height, auto)",
    maxWidth: "var(--available-width)",
};

const POPUP_LAYOUT_STYLE: React.CSSProperties = {
    position: "relative",
    width: "var(--popup-width, auto)",
    height: "var(--popup-height, auto)",
};

export function Portal(
    props: SelectionPortalProps,
): React.JSX.Element {
    return <Popover.Portal {...props} />;
}

export function Positioner(
    props: SelectionPositionerProps,
): React.JSX.Element | null {
    const {
        children,
        sideOffset = DEFAULT_SIDE_OFFSET,
        collisionPadding = DEFAULT_COLLISION_PADDING,
        arrowPadding = DEFAULT_ARROW_PADDING,
        style,
        ...positionerProps
    } = props;

    const { selection, popupRef, open, dismiss } = useSelectionRootContext();
    const [side, setSide] = React.useState<SelectionSide>("top");
    const animationFrame = useAnimationFrame();

    const anchor = React.useMemo<SelectionAnchor | null>(() => {
        if (!selection) {
            return null;
        }
        return createVirtualAnchor(selection.range, selection.area, side);
    }, [selection, side]);

    const paddingTop = getPaddingSide(collisionPadding, "top");
    const paddingBottom = getPaddingSide(collisionPadding, "bottom");

    const refreshSide = React.useCallback(() => {
        if (!selection) {
            return;
        }

        const popup = popupRef.current;
        if (!popup) {
            return;
        }

        const desiredSide = getDesiredSide(
            selection.range,
            getPopupHeight(popup),
            sideOffset,
            paddingTop,
            paddingBottom,
        );

        if (!desiredSide) {
            dismiss("collision");
            return;
        }

        setSide((previous) =>
            previous === desiredSide ? previous : desiredSide,
        );
    }, [dismiss, paddingBottom, paddingTop, popupRef, selection, sideOffset]);

    useIsoLayoutEffect(() => {
        if (!open) {
            return;
        }
        refreshSide();
    }, [open, refreshSide]);

    React.useEffect(() => {
        if (!open) {
            return;
        }

        const schedule = () => {
            animationFrame.request(refreshSide);
        };

        const popup = popupRef.current;
        const area = selection?.area ?? null;
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(schedule);

        if (popup) {
            observer?.observe(popup);
        }
        if (area) {
            observer?.observe(area);
        }

        window.addEventListener("scroll", schedule, true);
        window.addEventListener("resize", schedule);

        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", schedule);
        viewport?.addEventListener("scroll", schedule);

        return () => {
            animationFrame.cancel();
            observer?.disconnect();
            window.removeEventListener("scroll", schedule, true);
            window.removeEventListener("resize", schedule);
            viewport?.removeEventListener("resize", schedule);
            viewport?.removeEventListener("scroll", schedule);
        };
    }, [animationFrame, open, popupRef, refreshSide, selection?.area]);

    if (!selection || !anchor) {
        return null;
    }

    return (
        <Popover.Positioner
            {...positionerProps}
            anchor={anchor}
            side={side}
            align="center"
            sideOffset={sideOffset}
            arrowPadding={arrowPadding}
            collisionPadding={collisionPadding}
            collisionAvoidance={COLLISION_AVOIDANCE}
            style={{ ...POSITIONER_LAYOUT_STYLE, ...style }}
        >
            {children}
        </Popover.Positioner>
    );
}

export function Popup(props: SelectionPopupProps): React.JSX.Element {
    const {
        children,
        render,
        style,
        onKeyDown,
        onPointerDown,
        ref,
        ...popupProps
    } = props;

    const {
        popupRef,
        open,
        label,
        focusShortcut,
        dismiss,
        consumeFocusOnOpen,
        focusFirstItem,
    } = useSelectionRootContext();

    const handleRef = useMergedRefs(popupRef, ref);

    const handleKeyDown = React.useCallback(
        (
            event: Parameters<NonNullable<Popover.Popup.Props["onKeyDown"]>>[0],
        ) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || event.key !== "Tab") {
                return;
            }

            event.preventDefault();
            dismiss("tab-out");
        },
        [dismiss, onKeyDown],
    );

    const handlePointerDown = React.useCallback(
        (
            event: Parameters<
                NonNullable<Popover.Popup.Props["onPointerDown"]>
            >[0],
        ) => {
            onPointerDown?.(event);
            if (event.defaultPrevented) {
                return;
            }
            if (event.button !== 0 || event.pointerType === "touch") {
                return;
            }
            event.preventDefault();
        },
        [onPointerDown],
    );

    useIsoLayoutEffect(() => {
        if (!open || !consumeFocusOnOpen()) {
            return;
        }
        focusFirstItem();
    }, [consumeFocusOnOpen, focusFirstItem, open]);

    const ariaShortcut =
        focusShortcut === false ? undefined : toAriaShortcut(focusShortcut);

    return (
        <Popover.Popup
            {...popupProps}
            ref={handleRef}
            render={<Toolbar.Root render={render} />}
            initialFocus={false}
            finalFocus={false}
            role="toolbar"
            aria-label={label}
            aria-keyshortcuts={ariaShortcut}
            style={{ ...POPUP_LAYOUT_STYLE, ...style }}
            onKeyDown={handleKeyDown}
            onPointerDown={handlePointerDown}
        >
            {children}
        </Popover.Popup>
    );
}

export function Item(props: SelectionItemProps): React.JSX.Element {
    const { closeOnClick = true, onClick, ...buttonProps } = props;
    const { dismiss } = useSelectionRootContext();

    const handleClick = React.useCallback(
        (
            event: Parameters<NonNullable<Toolbar.Button.Props["onClick"]>>[0],
        ) => {
            onClick?.(event);
            if (!closeOnClick) {
                return;
            }
            dismiss("close-press");
        },
        [closeOnClick, dismiss, onClick],
    );

    return (
        <Toolbar.Button
            {...buttonProps}
            data-base-ui-selection-item=""
            onClick={handleClick}
        />
    );
}

export function Separator(
    props: SelectionSeparatorProps,
): React.JSX.Element {
    return <Toolbar.Separator {...props} />;
}

export function Arrow(props: SelectionArrowProps): React.JSX.Element {
    return <Popover.Arrow {...props} />;
}

export function Viewport(
    props: SelectionViewportProps,
): React.JSX.Element {
    return <Popover.Viewport {...props} />;
}
