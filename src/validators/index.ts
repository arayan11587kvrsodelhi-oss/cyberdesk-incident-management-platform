import { z } from "zod";

const id = z.coerce.number().int().positive("Required");

const strip = (v: string) => v.replace(/\u0000/g, "").trim();

export const titleField = (label: string, max = 140) =>
  z
    .string()
    .transform(strip)
    .pipe(z.string().min(3, `${label} must be at least 3 characters`).max(max, `Max ${max} characters`));

export const bodyField = (label: string, max = 4000) =>
  z
    .string()
    .transform(strip)
    .pipe(z.string().min(1, `${label} is required`).max(max, `Max ${max} characters`));

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const INCIDENT_STATUSES = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"] as const;
export const ALERT_STATUSES = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"] as const;
export const ALERT_SOURCES = ["EDR", "NETWORK", "IDENTITY", "CLOUD", "EMAIL", "MANUAL"] as const;
export const ASSET_TYPES = ["SERVER", "LAPTOP", "DATABASE", "API", "CLOUD", "CONTAINER"] as const;
export const ASSET_ENVS = ["PRODUCTION", "STAGING", "DEVELOPMENT"] as const;
export const ASSET_STATUSES = ["HEALTHY", "WARNING", "CRITICAL", "OFFLINE"] as const;
export const TASK_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export const ROLES = ["ADMIN", "ANALYST", "VIEWER"] as const;

/* ----------------------------- auth ------------------------------ */

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{10,72}$/;

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Maximum 72 characters")
  .refine((v) => PASSWORD_RE.test(v), {
    message: "Include upper, lower, a number and a symbol",
  });

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().transform(strip).pipe(z.string().min(2, "Enter your full name").max(80)),
    email: z.string().transform((v) => v.toLowerCase()).pipe(z.string().email("Enter a valid email")),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const forgotSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
});

export const resetSchema = z
  .object({
    token: z.string().min(10, "Invalid reset token"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const profileSchema = z.object({
  name: z.string().transform(strip).pipe(z.string().min(2, "Enter your full name").max(80)),
});

/* --------------------------- incidents --------------------------- */

export const incidentSchema = z.object({
  title: titleField("Title"),
  description: bodyField("Description", 4000),
  severity: z.enum(SEVERITIES),
  status: z.enum(INCIDENT_STATUSES),
  assigneeId: id.nullable().optional(),
  assetIds: z.array(id).max(20).default([]),
  tags: z.string().max(200).default(""),
});

export const incidentUpdateSchema = incidentSchema.partial();

/* ---------------------------- alerts ----------------------------- */

export const alertSchema = z.object({
  title: titleField("Title"),
  detail: z.string().max(2000).transform(strip).default(""),
  source: z.enum(ALERT_SOURCES),
  severity: z.enum(SEVERITIES),
  status: z.enum(ALERT_STATUSES),
  detectedAt: z.coerce.date().optional(),
  incidentId: id.nullable().optional(),
});

export const alertUpdateSchema = alertSchema.partial();

/* ---------------------------- assets ----------------------------- */

export const assetSchema = z.object({
  name: titleField("Name"),
  type: z.enum(ASSET_TYPES),
  ipAddress: z
    .string()
    .transform(strip)
    .refine((v) => v === "" || /^(?:\d{1,3}\.){3}\d{1,3}$|^[a-z0-9.-]+$/i.test(v), {
      message: "Enter a valid IP address or hostname",
    })
    .optional(),
  environment: z.enum(ASSET_ENVS),
  status: z.enum(ASSET_STATUSES),
  ownerId: id.nullable().optional(),
  lastSeen: z.coerce.date().optional(),
});

export const assetUpdateSchema = assetSchema.partial();

/* --------------------------- notes ------------------------------- */

export const noteSchema = z.object({
  title: titleField("Title"),
  body: bodyField("Note", 6000),
  incidentId: id,
});

export const noteUpdateSchema = noteSchema.partial();

/* ---------------------------- tasks ------------------------------ */

export const taskSchema = z.object({
  title: titleField("Title"),
  description: z.string().max(3000).transform(strip).default(""),
  incidentId: id,
  assigneeId: id.nullable().optional(),
  priority: z.enum(TASK_PRIORITIES),
  status: z.enum(TASK_STATUSES),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
});

export const taskUpdateSchema = taskSchema.partial();

/* ----------------------------- team ------------------------------ */

export const teamCreateSchema = z.object({
  name: z.string().transform(strip).pipe(z.string().min(2, "Enter a full name").max(80)),
  email: z.string().transform((v) => v.toLowerCase()).pipe(z.string().email("Enter a valid email")),
  password: passwordSchema,
  role: z.enum(ROLES),
  title: z.string().max(80).transform(strip).default(""),
});

export const teamUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  status: z.enum(["ACTIVE", "DEACTIVATED"]).optional(),
  name: z.string().transform(strip).pipe(z.string().min(2).max(80)).optional(),
  title: z.string().max(80).transform(strip).optional(),
});

/** Rough client-side password strength for the live meter (server still validates). */
export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (pw.length >= 16) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^\w\s]/.test(pw)) score += 1;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent", "Excellent"];
  return { score: Math.min(score, 6), label: labels[Math.min(score, 6)] };
}
