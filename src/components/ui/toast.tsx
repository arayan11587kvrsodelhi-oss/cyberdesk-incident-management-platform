"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, CircleAlert, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; detail?: string };

type Ctx = {
  push: (t: Omit<Toast, "id">) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
};

const ToastContext = createContext<Ctx | null>(null);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++seq;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === "error" ? 7000 : 4200);
    },
    [dismiss],
  );

  const value = useMemo<Ctx>(
    () => ({
      push,
      success: (title, detail) => push({ kind: "success", title, detail }),
      error: (title, detail) => push({ kind: "error", title, detail }),
      info: (title, detail) => push({ kind: "info", title, detail }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-3 bottom-3 z-[90] flex flex-col items-stretch gap-2 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[380px]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              className="pointer-events-auto flex items-start gap-3 border border-[var(--border-strong)] bg-[var(--panel)] px-3.5 py-3 shadow-[var(--shadow)]"
              style={{ borderRadius: 4 }}
            >
              <span
                className="mt-0.5 shrink-0"
                style={{
                  color:
                    t.kind === "success" ? "var(--accent)" : t.kind === "error" ? "var(--crit)" : "var(--accent-2)",
                }}
              >
                {t.kind === "success" ? (
                  <CheckCircle2 size={16} />
                ) : t.kind === "error" ? (
                  <CircleAlert size={16} />
                ) : (
                  <Info size={16} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug break-words">{t.title}</p>
                {t.detail ? (
                  <p className="mt-0.5 text-[12px] leading-snug break-words text-[var(--muted)]">{t.detail}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 shrink-0 rounded-sm p-1 text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text)]"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ErrorCallout({ title, detail, className }: { title: string; detail?: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 border border-[color-mix(in_oklab,var(--crit)_45%,transparent)] bg-[color-mix(in_oklab,var(--crit)_10%,transparent)] px-3 py-2.5",
        className,
      )}
      style={{ borderRadius: 4 }}
    >
      <CircleAlert size={15} className="mt-0.5 shrink-0 text-[var(--crit)]" />
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-snug break-words">{title}</p>
        {detail ? <p className="mt-0.5 text-[12px] leading-snug break-words text-[var(--muted)]">{detail}</p> : null}
      </div>
    </div>
  );
}
