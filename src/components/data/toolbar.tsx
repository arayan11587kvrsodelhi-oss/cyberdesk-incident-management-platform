"use client";

import { Search, X, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function Toolbar({
  searchValue,
  onSearch,
  searchPlaceholder = "Search…",
  children,
  right,
  resultLabel,
}: {
  searchValue: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  children?: ReactNode;
  right?: ReactNode;
  resultLabel?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3.5 lg:flex-row lg:items-center">
      <div className="relative w-full lg:max-w-[320px]">
        <Search
          size={14}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]"
        />
        <Input
          type="search"
          value={searchValue}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="h-9 pl-8"
        />
      </div>

      {children ? <div className="flex flex-1 flex-wrap items-center gap-2">{children}</div> : null}

      <div className="flex items-center justify-between gap-3 lg:ml-auto lg:justify-end">
        {resultLabel ? <span className="mono text-[11px] text-[var(--muted)]">{resultLabel}</span> : null}
        {right}
      </div>
    </div>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const active = value !== "ALL";
  return (
    <label className="flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn("h-9 min-w-[132px]", active && "border-[var(--accent-2)]")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function ResetButton({ onReset, count }: { onReset: () => void; count: number }) {
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={onReset}
      className="flex h-9 items-center gap-1.5 rounded-[4px] border border-[var(--border)] px-2.5 text-[12px] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
    >
      <X size={13} />
      Clear {count}
      <SlidersHorizontal size={11} className="opacity-60" aria-hidden />
    </button>
  );
}

export function allOption(label = "All") {
  return { value: "ALL", label };
}
