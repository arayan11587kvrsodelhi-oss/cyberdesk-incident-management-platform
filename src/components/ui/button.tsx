"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[#04140A] hover:brightness-110 active:brightness-95 disabled:brightness-75 font-semibold",
  outline:
    "border border-[var(--border-strong)] bg-transparent text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-50",
  ghost: "bg-transparent text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--text)] disabled:opacity-50",
  danger:
    "border border-[color-mix(in_oklab,var(--crit)_55%,transparent)] bg-transparent text-[var(--crit)] hover:bg-[color-mix(in_oklab,var(--crit)_12%,transparent)] disabled:opacity-50",
  quiet: "border border-[var(--border)] bg-[var(--panel-2)] text-[var(--text)] hover:bg-[var(--hover)] disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px] gap-1.5",
  md: "h-9 px-3.5 text-[13px] gap-2",
  lg: "h-11 px-5 text-[14px] gap-2",
  icon: "h-9 w-9 justify-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "outline", size = "md", loading = false, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-[4px] transition-[background-color,color,filter,border-color] duration-150",
        "disabled:cursor-not-allowed",
        "active:translate-y-[0.5px]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={14} className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});
