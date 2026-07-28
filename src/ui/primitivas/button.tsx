import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type ButtonSize = "sm" | "md" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-text-inverse border-brand hover:bg-brand-hover active:bg-brand-active shadow-xs",
  secondary:
    "bg-bg-surface-raised text-text border-border hover:border-border-strong hover:bg-bg-surface",
  ghost:
    "bg-transparent text-text-secondary border-transparent hover:bg-bg-surface hover:text-text",
  danger:
    "bg-error text-text-inverse border-error hover:brightness-95 active:brightness-90",
  quiet:
    "bg-brand-subtle text-text-brand border-transparent hover:bg-success-subtle",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 gap-2 px-3 text-sm",
  md: "h-11 gap-2 px-5 text-sm",
  icon: "h-10 w-10 justify-center p-0",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md border font-heading font-medium tracking-normal transition disabled:cursor-not-allowed disabled:opacity-55",
        "active:scale-[0.98]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {size !== "icon" ? children : <span className="sr-only">{children}</span>}
    </button>
  );
}
