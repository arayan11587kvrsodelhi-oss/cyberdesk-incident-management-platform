import {
  pgTable,
  pgEnum,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ *
 * CYBERDESK — demo schema.
 * ALL seeded rows are fictional / simulated demonstration data.
 * ------------------------------------------------------------------ */

export const ROLE_VALUES = ["ADMIN", "ANALYST", "VIEWER"] as const;
export const SEVERITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const INCIDENT_STATUS_VALUES = [
  "OPEN",
  "INVESTIGATING",
  "CONTAINED",
  "RESOLVED",
  "CLOSED",
] as const;
export const ALERT_STATUS_VALUES = [
  "NEW",
  "ACKNOWLEDGED",
  "INVESTIGATING",
  "RESOLVED",
] as const;
export const ALERT_SOURCE_VALUES = [
  "EDR",
  "NETWORK",
  "IDENTITY",
  "CLOUD",
  "EMAIL",
  "MANUAL",
] as const;
export const ASSET_TYPE_VALUES = [
  "SERVER",
  "LAPTOP",
  "DATABASE",
  "API",
  "CLOUD",
  "CONTAINER",
] as const;
export const ASSET_ENV_VALUES = ["PRODUCTION", "STAGING", "DEVELOPMENT"] as const;
export const ASSET_STATUS_VALUES = ["HEALTHY", "WARNING", "CRITICAL", "OFFLINE"] as const;
export const TASK_PRIORITY_VALUES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export const TASK_STATUS_VALUES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export const USER_STATUS_VALUES = ["ACTIVE", "DEACTIVATED"] as const;

export const roleEnum = pgEnum("role", ROLE_VALUES);
export const severityEnum = pgEnum("severity", SEVERITY_VALUES);
export const incidentStatusEnum = pgEnum("incident_status", INCIDENT_STATUS_VALUES);
export const alertStatusEnum = pgEnum("alert_status", ALERT_STATUS_VALUES);
export const alertSourceEnum = pgEnum("alert_source", ALERT_SOURCE_VALUES);
export const assetTypeEnum = pgEnum("asset_type", ASSET_TYPE_VALUES);
export const assetEnvEnum = pgEnum("asset_env", ASSET_ENV_VALUES);
export const assetStatusEnum = pgEnum("asset_status", ASSET_STATUS_VALUES);
export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITY_VALUES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUS_VALUES);
export const userStatusEnum = pgEnum("user_status", USER_STATUS_VALUES);

/* ----------------------------- users ----------------------------- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull().default("VIEWER"),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email), index("users_role_idx").on(t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

/* ---------------------------- assets ----------------------------- */

export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    type: assetTypeEnum("type").notNull(),
    ipAddress: text("ip_address"),
    environment: assetEnvEnum("environment").notNull().default("PRODUCTION"),
    status: assetStatusEnum("status").notNull().default("HEALTHY"),
    ownerId: integer("owner_id").references(() => users.id, { onDelete: "set null" }),
    lastSeen: timestamp("last_seen", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assets_type_idx").on(t.type),
    index("assets_env_idx").on(t.environment),
    index("assets_status_idx").on(t.status),
  ],
);

/* -------------------------- incidents ---------------------------- */

export const incidents = pgTable(
  "incidents",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    severity: severityEnum("severity").notNull().default("MEDIUM"),
    status: incidentStatusEnum("status").notNull().default("OPEN"),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    createdById: integer("created_by_id").references(() => users.id, { onDelete: "set null" }),
    tags: text("tags").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("incidents_status_idx").on(t.status),
    index("incidents_severity_idx").on(t.severity),
    index("incidents_assignee_idx").on(t.assigneeId),
    index("incidents_created_at_idx").on(t.createdAt),
  ],
);

export const incidentAssets = pgTable(
  "incident_assets",
  {
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("incident_asset_uq").on(t.incidentId, t.assetId)],
);

/* ---------------------------- alerts ----------------------------- */

export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    title: text("title").notNull(),
    source: alertSourceEnum("source").notNull().default("EDR"),
    severity: severityEnum("severity").notNull().default("MEDIUM"),
    status: alertStatusEnum("status").notNull().default("NEW"),
    detail: text("detail").notNull().default(""),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    incidentId: integer("incident_id").references(() => incidents.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("alerts_severity_idx").on(t.severity),
    index("alerts_status_idx").on(t.status),
    index("alerts_source_idx").on(t.source),
    index("alerts_incident_idx").on(t.incidentId),
    index("alerts_detected_idx").on(t.detectedAt),
  ],
);

/* --------------------- investigation notes ----------------------- */

export const investigationNotes = pgTable(
  "investigation_notes",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notes_incident_idx").on(t.incidentId), index("notes_author_idx").on(t.authorId)],
);

/* ----------------------------- tasks ----------------------------- */

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    incidentId: integer("incident_id")
      .notNull()
      .references(() => incidents.id, { onDelete: "cascade" }),
    assigneeId: integer("assignee_id").references(() => users.id, { onDelete: "set null" }),
    priority: taskPriorityEnum("priority").notNull().default("MEDIUM"),
    status: taskStatusEnum("status").notNull().default("TODO"),
    dueDate: date("due_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_status_idx").on(t.status),
    index("tasks_priority_idx").on(t.priority),
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_incident_idx").on(t.incidentId),
    index("tasks_due_idx").on(t.dueDate),
  ],
);

/* -------------------------- activity log ------------------------- */

export const activityLogs = pgTable(
  "activity_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    entityKey: text("entity_key"),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("activity_entity_idx").on(t.entityType, t.entityId),
    index("activity_created_idx").on(t.createdAt),
  ],
);

export type User = typeof users.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type InvestigationNote = typeof investigationNotes.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
