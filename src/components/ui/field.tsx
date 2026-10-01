"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Eye, EyeOff, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const baseControl =
  "w-full rounded-[4px] border border-[var(--border-strong)] bg-[var(--bg-raise)] px-3 text-[13px] text-[var(--text)] " +
  "placeholder:text-[var(--muted-2)] transition-colors duration-150 hover:border-[color-mix(in_oklab,var(--text)_28%,transparent)] " +
  "focus:border-[var(--accent-2)] focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(baseControl, "h-9", invalid && "border-[var(--crit)]", className)}
        {...rest}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ className, invalid, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(baseControl, "min-h-[96px] resize-y py-2 leading-relaxed", invalid && "border-[var(--crit)]", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; placeholder?: string }
>(function Select({ className, invalid, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(baseControl, "h-9 appearance-none pr-8", invalid && "border-[var(--crit)]", className)}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
      />
    </div>
  );
});

export function PasswordInput({
  className,
  invalid,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        aria-invalid={invalid || undefined}
        className={cn(baseControl, "h-9 pr-10", invalid && "border-[var(--crit)]", className)}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-[3px] p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
      >
        {visible ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor: string; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="label text-[var(--muted)]">
        {children}
      </label>
      {hint ? <span className="mono text-[10px] text-[var(--muted-2)]">{hint}</span> : null}
    </div>
  );
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12px] leading-snug text-[var(--crit)]">
      {message}
    </p>
  );
}
