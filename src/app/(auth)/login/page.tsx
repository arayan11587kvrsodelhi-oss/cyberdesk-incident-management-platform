"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, PasswordInput } from "@/components/ui/field";
import { ErrorCallout } from "@/components/ui/toast";
import { ApiClientError, api } from "@/lib/client";

const DEMO = { email: "mara.ellison@nighthawk.demo", password: "Cyberdesk!Demo2026" };

function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "Email is required";
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) nextErrors.email = "Enter a valid email";
    if (!password) nextErrors.password = "Password is required";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      await api<{ redirect: string }>("/api/auth/login", { method: "POST", body: { email, password } });
      const dest = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
      router.push(dest && dest.startsWith("/") ? dest : "/dashboard");
      router.refresh();
    } catch (err) {
      const e2 = err as ApiClientError;
      setFormError(e2.message ?? "Sign-in failed.");
      setErrors(e2.fields ?? {});
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Sign in"
      title="Open the operations console"
      intro="Authenticate to reach your workspace. Sessions are server-issued and cookies are httpOnly."
      footer={
        <p className="text-[12.5px] text-[var(--muted)]">
          No account yet?{" "}
          <Link href="/register" className="text-[var(--accent-2)] underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? <ErrorCallout title={formError} /> : null}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            placeholder="you@workspace.example"
          />
          <FieldError id="email-error" message={errors.email} />
        </div>

        <div>
          <Label htmlFor="password" hint="min 10 characters">
            Password
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            placeholder="••••••••••"
          />
          <FieldError id="password-error" message={errors.password} />
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <Link
            href="/forgot-password"
            className="text-[12.5px] text-[var(--muted)] underline-offset-4 transition-colors hover:text-[var(--text)] hover:underline"
          >
            Forgot password?
          </Link>
          <Button type="submit" variant="primary" loading={loading} className="min-w-[110px]">
            {loading ? "Verifying" : "Sign in"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border border-[var(--border)] bg-[var(--panel)] p-3.5" style={{ borderRadius: 4 }}>
        <p className="label text-[var(--warn)]">Demo credentials · fictional</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--muted)]">
          <span className="mono text-[var(--text)]">{DEMO.email}</span>
          <br />
          <span className="mono text-[var(--text)]">{DEMO.password}</span>
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => {
            setEmail(DEMO.email);
            setPassword(DEMO.password);
          }}
        >
          Fill demo credentials
        </Button>
        <p className="mt-2.5 text-[11px] leading-relaxed text-[var(--muted-2)]">
          Seeded accounts belong to a fictional team. No real credentials are used anywhere in this project.
        </p>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
