"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";
import { Button } from "./button";
import { ToastContext, useToast, type ToastItem } from "./internal/toast-context";

export { useToast };

/** Mínimo con acción "Deshacer": permanece 5 s y no se cierra si el foco
 * está dentro (`18` §6); sin acción, 4 s. */
const DURATION_WITH_ACTION_MS = 5000;
const DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...toast, id }]);
      const duration = toast.actionLabel ? DURATION_WITH_ACTION_MS : DURATION_MS;
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), duration)
      );
    },
    [dismiss]
  );

  function pause(id: string) {
    clearTimeout(timers.current.get(id));
  }

  function resume(id: string, hasAction: boolean) {
    timers.current.set(
      id,
      setTimeout(() => dismiss(id), hasAction ? DURATION_WITH_ACTION_MS : DURATION_MS)
    );
  }

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed bottom-4 right-4 z-toast flex flex-col gap-2"
              aria-live="polite"
              aria-atomic="false"
            >
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  role="status"
                  onFocus={() => pause(toast.id)}
                  onBlur={() => resume(toast.id, Boolean(toast.actionLabel))}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border border-border bg-bg-inverse px-4 py-3 text-sm text-text-inverse shadow-lg"
                  )}
                >
                  <span>{toast.message}</span>
                  {toast.actionLabel ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-text-inverse hover:bg-white/10"
                      onClick={() => {
                        toast.onAction?.();
                        dismiss(toast.id);
                      }}
                    >
                      {toast.actionLabel}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}
