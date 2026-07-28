import type { HTMLAttributes } from "react";
import { cn } from "./cn";
import { useDialogContentContext } from "./internal/dialog-context";

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 pr-8", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDialogContentContext("DialogTitle");
  return (
    <h2
      id={titleId}
      className={cn("font-heading text-lg font-semibold text-text", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDialogContentContext("DialogDescription");
  return (
    <p
      id={descriptionId}
      className={cn("mt-1 text-sm text-text-secondary", className)}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
