import { type MouseEvent, type PointerEvent, type ReactNode } from "react";

type AppModalBackdropProps = {
  children: ReactNode;
  onClose: () => void;
  dismissOnBackdrop?: boolean;
  className?: string;
  testId?: string;
};

/** Full-viewport pointer barrier shared by React dialogs. */
export const AppModalBackdrop = ({
  children,
  onClose,
  dismissOnBackdrop = false,
  className,
  testId,
}: AppModalBackdropProps) => {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (dismissOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const clickedDialog = target.closest('[role="dialog"]');
    const clickedInteractive = target.closest(
      'a[href], button, input, textarea, select, label, [contenteditable="true"]',
    );
    const clickedBackdrop = event.target === event.currentTarget;
    if ((!clickedBackdrop && !clickedDialog) || clickedInteractive) return;
    if (clickedBackdrop && dismissOnBackdrop) return;

    event.preventDefault();
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      clickedDialog?.contains(activeElement)
    ) {
      activeElement.focus();
      return;
    }
    (clickedDialog ?? event.currentTarget)
      ?.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )
      ?.focus();
  };

  return (
    <div
      className={`app-modal-backdrop${className ? ` ${className}` : ""}`}
      onPointerDownCapture={handlePointerDown}
      onClick={handleClick}
      data-testid={testId}
    >
      {children}
    </div>
  );
};
