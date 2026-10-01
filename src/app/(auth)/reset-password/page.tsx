"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label, PasswordInput } from "@/components/ui/field";
import { ErrorCallout } from "@/components/ui/toast";
import { ApiClientError, api } from "@/lib/client";
import { passwordStrength } from "@/validators";

const STRENGTH_COLOR = ["var(--crit)", "var(--crit)", "var(--warn)", "var(--warn)", "var(--accent-2)", "var(--accent)", "var(--accent)"];

function ResetForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Read the token from the URL after mount so the page still prerenders.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const t = new URLSearchParams(window.location.search).get("token");
      if (t) setToken(t);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const strength = passwordStrength(password);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);

    const next: Record<string, string> = {};
    if (!token.trim()) next.token = "Reset token is required";
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,72}$/.test(password)) {
      next.password = "Include upper, lower, a number and a symbol (min 10 characters)";
    }
    if (confirm !== password) next.confirmPassword = "Passwords do not match";
    if (Object.keys(next).length) {
      setErrors(next);
      return;
    }

    setLoading(true);
    try {
      await api("/api/auth/reset", { method: "POST", body: { token, password, confirmPassword: confirm } });
      setDone(true);
      setTimeout(() => router.push("/login"), 1400);
    } catch (err) {
      const e2 = err as ApiClientError;
      setFormError(e2.message ?? "Reset failed.");
      setErrors(e2.fields ?? {});
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Choose a new password"
      intro="Tokens are single-use and expire after one hour. Existing sessions are revoked when the reset completes."
      footer={
        <p className="text-[12.5px] text-[var(--muted)]">
          Need a new token?{" "}
          <Link href="/forgot-password" className="text-[var(--accent-2)] underline-offset-4 hover:underline">
            Request another
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
            Password updated. Redirecting to sign in…
          </div>
        ) : null}

        <div>
          <Label htmlFor="token">Reset token</Label>
          <Input
            id="token"
            name="token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            invalid={Boolean(errors.token)}
            className="mono text-[12px]"
            placeholder="paste the token from the recovery step"
          />
          <FieldError message={errors.token} />
        </div>

        <div>
          <Label htmlFor="new-password" hint="upper · lower · number · symbol">
            New password
          </Label>
          <PasswordInput
            id="new-password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(errors.password)}
          />
          <div className="mt-2 flex items-center gap-2" aria-hidden>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="h-[3px] flex-1"
                style={{
                  background: i < strength.score ? STRENGTH_COLOR[strength.score] : "var(--border)",
                  borderRadius: 2,
                  transition: "background-color 200ms",
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
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={Boolean(errors.confirmPassword)}
          />
          <FieldError message={errors.confirmPassword} />
        </div>

        <Button type="submit" variant="primary" loading={loading} className="w-full">
          {loading ? "Updating" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return <ResetForm />;
}
