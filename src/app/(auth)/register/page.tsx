"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, PasswordInput } from "@/components/ui/field";
import { ErrorCallout } from "@/components/ui/toast";
import { ApiClientError, api } from "@/lib/client";
import { passwordStrength } from "@/validators";

const STRENGTH_COLOR = ["var(--crit)", "var(--crit)", "var(--warn)", "var(--warn)", "var(--accent-2)", "var(--accent)", "var(--accent)"];

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const strength = passwordStrength(form.password);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Enter your full name";
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email";
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,72}$/.test(form.password)) {
      next.password = "Include upper, lower, a number and a symbol (min 10 characters)";
    }
    if (form.confirmPassword !== form.password) next.confirmPassword = "Passwords do not match";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      await api<{ redirect: string }>("/api/auth/register", { method: "POST", body: form });
      setDone(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 700);
    } catch (err) {
      const e2 = err as ApiClientError;
      setFormError(e2.message ?? "Registration failed.");
      setErrors(e2.fields ?? {});
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Create account"
      title="Provision a workspace account"
      intro="New accounts are created as ANALYST. An administrator can change your role later on the Team page."
      footer={
        <p className="text-[12.5px] text-[var(--muted)]">
          Already registered?{" "}
          <Link href="/login" className="text-[var(--accent-2)] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {formError ? <ErrorCallout title={formError} /> : null}
        {done ? (
          <div
            className="border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3 py-2.5 text-[13px]"
            style={{ borderRadius: 4 }}
            role="status"
          >
            Account created. Opening your workspace…
          </div>
        ) : null}

        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            autoFocus
            value={form.name}
            onChange={set("name")}
            invalid={Boolean(errors.name)}
            placeholder="Alex Marchetti"
          />
          <FieldError message={errors.name} />
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            invalid={Boolean(errors.email)}
            placeholder="you@workspace.example"
          />
          <FieldError message={errors.email} />
        </div>

        <div>
          <Label htmlFor="password" hint="upper · lower · number · symbol">
            Password
          </Label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            invalid={Boolean(errors.password)}
          />
          <div className="mt-2 flex items-center gap-2" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="h-[3px] flex-1 transition-colors duration-200"
                style={{
                  background: i < strength.score ? STRENGTH_COLOR[strength.score] : "var(--border)",
                  borderRadius: 2,
                }}
              />
            ))}
          </div>
          <p className="mono mt-1.5 text-[10px] tracking-[0.1em] uppercase" style={{ color: STRENGTH_COLOR[strength.score] }}>
            strength · {strength.label}
          </p>
          <FieldError message={errors.password} />
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            invalid={Boolean(errors.confirmPassword)}
          />
          <FieldError message={errors.confirmPassword} />
        </div>

        <div className="flex items-center justify-end pt-1">
          <Button type="submit" variant="primary" loading={loading} className="min-w-[150px]">
            {loading ? "Creating account" : "Create account"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
