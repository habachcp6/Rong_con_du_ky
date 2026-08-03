import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const focusableElements = (element: HTMLElement): HTMLElement[] =>
  Array.from(element.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (candidate) => !candidate.hasAttribute("hidden"),
  );

/** Gives every React modal the same Esc close and cyclic Tab behavior without
 * exposing Phaser scene internals to the DOM layer. */
export function useModalAccessibility(
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
  isOpen = true,
): void {
  const onCloseRef = useRef(onClose);

  // Keep the keyboard listener current without tearing down the focus trap
  // whenever a parent recreates an inline close callback.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const panel = ref.current;
    if (!panel) return;
    const priorFocus = document.activeElement;
    const returnFocusTarget =
      priorFocus instanceof HTMLElement && priorFocus !== document.body
        ? priorFocus
        : null;

    const focusInitial = window.requestAnimationFrame(() => {
      (focusableElements(panel)[0] ?? panel).focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const targets = focusableElements(panel);
      if (targets.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = targets[0];
      const last = targets.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInitial);
      window.removeEventListener("keydown", onKeyDown);
      // Do not steal focus from another modal that replaces this one (for
      // example Passport -> ending). Otherwise return keyboard users to the
      // exact control that opened the dismissed modal.
      window.requestAnimationFrame(() => {
        const anotherModal = document.querySelector(
          '[role="dialog"][aria-modal="true"]',
        );
        if (!anotherModal && returnFocusTarget?.isConnected) {
          returnFocusTarget.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen, ref]);
}
