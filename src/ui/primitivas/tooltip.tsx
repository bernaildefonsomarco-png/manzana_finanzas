"use client";

import { cloneElement, isValidElement, useId, useState, type ReactElement } from "react";
import { cn } from "./cn";

type TriggerProps = {
  onMouseEnter?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
  onFocus?: (event: React.FocusEvent) => void;
  onBlur?: (event: React.FocusEvent) => void;
  "aria-describedby"?: string;
};

function compose<E>(existing: ((event: E) => void) | undefined, next: (event: E) => void) {
  return (event: E) => {
    existing?.(event);
    next(event);
  };
}

type TooltipProps = {
  content: string;
  children: ReactElement<TriggerProps>;
};

/**
 * Ayuda breve (`16` §4.2): aparece con foco de teclado, no solo con ratón —
 * por eso escucha `onFocus`/`onBlur` además de `onMouseEnter`/`onMouseLeave`
 * sobre el propio disparador, en vez de exigir un `<span>` envolvente que
 * intercepte el ratón pero no el teclado.
 */
export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  if (!isValidElement(children)) return children;

  const trigger = cloneElement(children, {
    onMouseEnter: compose(children.props.onMouseEnter, () => setVisible(true)),
    onMouseLeave: compose(children.props.onMouseLeave, () => setVisible(false)),
    onFocus: compose(children.props.onFocus, () => setVisible(true)),
    onBlur: compose(children.props.onBlur, () => setVisible(false)),
    "aria-describedby": id,
  });

  return (
    <span className="relative inline-block">
      {trigger}
      {visible ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-tooltip mb-2 -translate-x-1/2 whitespace-nowrap rounded-md bg-bg-inverse px-2 py-1 text-xs text-text-inverse shadow-md"
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
