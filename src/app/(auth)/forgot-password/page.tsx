"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { FieldError, Input, Label } from "@/components/ui/field";
import { ErrorCallout } from "@/components/ui/toast";
import { ApiClientError, api } from "@/lib/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ message: string; demoToken: string | null } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldError(undefined);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFieldError("Enter a valid email");
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ message: string; demoToken: string | null }>("/api/auth/forgot", {
        method: "POST",
        body: { email },
      });
      setResult(res);
    } catch (err) {
      setError((err as ApiClientError).message ?? "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset your password"
      intro="This demo does not send email. In local development, a single-use reset token is shown so the recovery flow can be tested end-to-end; production never exposes reset tokens."
      footer={
        <p className="text-[12.5px] text-[var(--muted)]">
          Remembered it?{" "}
          <Link href="/login" className="text-[var(--accent-2)] underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {result ? (
        <div className="space-y-4">
          <div
            className="border border-[color-mix(in_oklab,var(--accent)_45%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-3.5 py-3 text-[13px] leading-relaxed"
            style={{ borderRadius: 4 }}
            role="status"
          >
            {result.message}
          </div>
          {result.demoToken ? (
            <>
              <div className="border border-[var(--border)] bg-[var(--panel)] p-3.5" style={{ borderRadius: 4 }}>
                <p className="label text-[var(--warn)]">Local demo token · no email sent</p>
                <p className="mono mt-2 text-[12px] break-all text-[var(--muted)]">{result.demoToken}</p>
              </div>
              <Link href={`/reset-password?token=${encodeURIComponent(result.demoToken)}`}>
                <Button variant="primary" className="w-full">
                  Continue to reset
                </Button>
              </Link>
            </>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="w-full">
                Return to sign in
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <ErrorCallout title={error} /> : null}
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
              invalid={Boolean(fieldError)}
              placeholder="you@workspace.example"
            />
            <FieldError message={fieldError} />
          </div>
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            {loading ? "Requesting reset" : "Request password reset"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
