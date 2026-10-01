import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  activityLogs,
  alerts,
  assets,
  incidentAssets,
  incidents,
  investigationNotes,
  sessions,
  tasks,
  users,
} from "./schema";
import { hashPassword } from "../lib/password";

/* ------------------------------------------------------------------ *
 * CYBERDESK demo seed.
 *
 * EVERY ROW WRITTEN HERE IS FICTIONAL, SIMULATED DEMONSTRATION DATA.
 * Organisation names, assets, IPs, incidents, alerts, notes, tasks and
 * people are invented for this portfolio project. Nothing here reflects
 * a real security event, real customer, real telemetry or real threat.
 * ------------------------------------------------------------------ */

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 60 * 60 * 1000);

/** Demo-only credentials. Documented in the README as fictional. */
const DEMO_PASSWORD = "Cyberdesk!Demo2026";

const TEAM = [
  { name: "Mara Ellison", email: "mara.ellison@nighthawk.demo", role: "ADMIN" as const, title: "Security Operations Lead" },
  { name: "Dev Raghunathan", email: "dev.raghunathan@nighthawk.demo", role: "ANALYST" as const, title: "Senior Detection Analyst" },
  { name: "Ingrid Solberg", email: "ingrid.solberg@nighthawk.demo", role: "ANALYST" as const, title: "Incident Responder" },
  { name: "Tomas Ferreira", email: "tomas.ferreira@nighthawk.demo", role: "ANALYST" as const, title: "Threat Hunter" },
  { name: "Aiko Nakamura", email: "aiko.nakamura@nighthawk.demo", role: "ANALYST" as const, title: "Forensics Analyst" },
  { name: "Priya Balakrishnan", email: "priya.balakrishnan@nighthawk.demo", role: "VIEWER" as const, title: "Platform Engineering Manager" },
  { name: "Owen Whitlock", email: "owen.whitlock@nighthawk.demo", role: "VIEWER" as const, title: "Compliance Coordinator" },
  { name: "Sofia Marchetti", email: "sofia.marchetti@nighthawk.demo", role: "VIEWER" as const, title: "Service Desk Supervisor" },
];

const ASSET_ROWS = [
  ["nws-edge-gw-01", "Edge Gateway", "SERVER", "10.42.0.1", "PRODUCTION", "HEALTHY"],
  ["nws-edge-gw-02", "Edge Gateway", "SERVER", "10.42.0.2", "PRODUCTION", "HEALTHY"],
  ["nws-bastion-01", "Bastion Host", "SERVER", "10.42.8.11", "PRODUCTION", "WARNING"],
  ["nws-app-01", "Application Node", "SERVER", "10.42.12.21", "PRODUCTION", "HEALTHY"],
  ["nws-app-02", "Application Node", "SERVER", "10.42.12.22", "PRODUCTION", "HEALTHY"],
  ["nws-app-03", "Application Node", "SERVER", "10.42.12.23", "STAGING", "HEALTHY"],
  ["nws-worker-01", "Batch Worker", "SERVER", "10.42.14.31", "PRODUCTION", "HEALTHY"],
  ["nws-worker-02", "Batch Worker", "SERVER", "10.42.14.32", "PRODUCTION", "CRITICAL"],
  ["nws-catalog-db", "Primary Database", "DATABASE", "10.42.20.10", "PRODUCTION", "HEALTHY"],
  ["nws-replica-db", "Read Replica", "DATABASE", "10.42.20.11", "PRODUCTION", "WARNING"],
  ["nws-ledger-db", "Ledger Database", "DATABASE", "10.42.20.14", "PRODUCTION", "HEALTHY"],
  ["nws-sandbox-db", "Sandbox Database", "DATABASE", "10.42.21.10", "DEVELOPMENT", "OFFLINE"],
  ["nws-billing-api", "Billing API", "API", "api.nighthawk.demo/v2", "PRODUCTION", "HEALTHY"],
  ["nws-identity-api", "Identity API", "API", "id.nighthawk.demo/v1", "PRODUCTION", "WARNING"],
  ["nws-search-api", "Search API", "API", "search.nighthawk.demo/v1", "STAGING", "HEALTHY"],
  ["nws-partner-api", "Partner API", "API", "partners.nighthawk.demo/v3", "PRODUCTION", "HEALTHY"],
  ["nws-vm-bastion-win", "Ops Workstation", "LAPTOP", "10.42.60.14", "PRODUCTION", "HEALTHY"],
  ["nws-laptop-mara", "Analyst Laptop", "LAPTOP", "10.42.60.21", "PRODUCTION", "HEALTHY"],
  ["nws-laptop-dev", "Analyst Laptop", "LAPTOP", "10.42.60.22", "PRODUCTION", "HEALTHY"],
  ["nws-laptop-finance", "Finance Laptop", "LAPTOP", "10.42.61.8", "PRODUCTION", "WARNING"],
  ["nws-laptop-newhire", "Onboarding Laptop", "LAPTOP", "10.42.61.19", "DEVELOPMENT", "OFFLINE"],
  ["nws-oidc-cluster", "Identity Cluster", "CLOUD", "eu-west-1 / account-0042", "PRODUCTION", "HEALTHY"],
  ["nws-obj-store", "Object Storage", "CLOUD", "eu-west-1 / account-0042", "PRODUCTION", "WARNING"],
  ["nws-lambda-ingest", "Ingestion Functions", "CLOUD", "eu-central-1 / account-0077", "PRODUCTION", "HEALTHY"],
  ["nws-svc-payments", "Payments Container", "CONTAINER", "k8s-prod / ns-payments", "PRODUCTION", "HEALTHY"],
  ["nws-svc-reporting", "Reporting Container", "CONTAINER", "k8s-prod / ns-reporting", "STAGING", "CRITICAL"],
] as const;

const INCIDENT_ROWS = [
  ["Repeated failed sign-ins against the identity API from three ASN ranges", "CRITICAL", "INVESTIGATING", [2, 15], ["identity", "credential-access"]],
  ["Unsigned binary executed on a finance operations laptop", "HIGH", "CONTAINED", [20, 17], ["endpoint", "execution"]],
  ["Object storage bucket policy loosened outside the change window", "HIGH", "OPEN", [22], ["cloud", "configuration"]],
  ["Nightly batch worker retry storm saturating the message queue", "MEDIUM", "INVESTIGATING", [7, 6], ["availability"]],
  ["Database replica lag exceeded the agreed service objective", "MEDIUM", "RESOLVED", [10, 11], ["database", "performance"]],
  ["Phishing lure impersonating the internal service desk", "HIGH", "RESOLVED", [13], ["email", "phishing"]],
  ["Container image pulled from an unapproved registry", "HIGH", "OPEN", [26, 25], ["container", "supply-chain"]],
  ["Legacy TLS cipher suites accepted on the partner API", "MEDIUM", "INVESTIGATING", [16], ["encryption"]],
  ["Staging search API returning cached records after logout", "MEDIUM", "CONTAINED", [15, 3], ["session", "data-exposure"]],
  ["Unusual outbound transfer volume from the edge gateway", "CRITICAL", "INVESTIGATING", [1, 2], ["network", "egress"]],
  ["Service account key rotated without an linked ticket", "LOW", "RESOLVED", [12], ["hygiene"]],
  ["Endpoint protection agent disabled on two workstations", "HIGH", "OPEN", [19, 18], ["endpoint"]],
  ["Backup job silently failing for the ledger database", "MEDIUM", "OPEN", [11], ["backup"]],
  ["Privileged group membership changed outside approval", "CRITICAL", "CONTAINED", [9, 14], ["identity", "privilege"]],
  ["Unscanned container image promoted to production namespace", "MEDIUM", "CLOSED", [25], ["container"]],
  ["Reporting service emitting stack traces to public logs", "LOW", "CLOSED", [24], ["logging", "hygiene"]],
] as const;

const ALERT_TITLES: [string, string, "EDR" | "NETWORK" | "IDENTITY" | "CLOUD" | "EMAIL" | "MANUAL"][] = [
  ["Brute-force pattern detected on identity endpoint", "A burst of 240 failed authentications from rotating source addresses.", "IDENTITY"],
  ["Process created from a temp directory", "Binary executed from an unusual writable path on a managed endpoint.", "EDR"],
  ["Public object ACL modification", "Bucket policy changed to allow anonymous read for 90 seconds.", "CLOUD"],
  ["Queue depth above threshold", "Message backlog stayed above the warning line for 12 minutes.", "NETWORK"],
  ["Replica lag warning", "Read replica trailing primary by more than the agreed objective.", "CLOUD"],
  ["Look-alike domain registered", "Domain closely mirrors the internal service desk naming pattern.", "EMAIL"],
  ["Unsigned image digest used at scheduling", "Container scheduled with an image that has no signature record.", "CLOUD"],
  ["Deprecated cipher negotiated", "Client negotiated a cipher suite listed as deprecated in policy.", "NETWORK"],
  ["Stale session cookie accepted", "Session token still valid after logout event on staging.", "IDENTITY"],
  ["Egress volume anomaly", "Outbound transfer rate 6x the 30-day baseline for this host.", "NETWORK"],
  ["Key used without linked change record", "Service account credential used outside a scheduled window.", "CLOUD"],
  ["Security agent service stopped", "Endpoint protection service was stopped on a managed device.", "EDR"],
  ["Backup verification failed", "Restore verification returned an incomplete snapshot set.", "MANUAL"],
  ["Privileged group modified", "Membership added to a privileged group without an approval reference.", "IDENTITY"],
  ["Registry mirror contacted", "Workload pulled an image from a mirror not on the allow list.", "NETWORK"],
  ["Verbose error surfaced to client", "Public response included an internal stack trace.", "MANUAL"],
  ["Impossible travel sign-in", "Session origins inconsistent within a short time window.", "IDENTITY"],
  ["Removable media mounted", "Unauthorised removable volume mounted on a workstation.", "EDR"],
  ["Firewall rule opened to wide range", "Ingress rule temporarily allowed traffic from a broad range.", "CLOUD"],
  ["Credential sprayed against API gateway", "Low-and-slow password guessing across three accounts.", "IDENTITY"],
  ["Suspicious scheduled task created", "Persistence-style scheduled task registered on a laptop.", "EDR"],
  ["Data query volume spike", "Single account issued a dramatically higher query volume than baseline.", "CLOUD"],
  ["Outbound mail burst", "Mailbox sent a burst of messages outside its normal pattern.", "EMAIL"],
  ["Kernel module loaded", "Unsigned kernel module loaded on a production node.", "EDR"],
  ["Health check bypassed", "Monitoring probe skipped for a production endpoint.", "MANUAL"],
  ["Token replay attempt", "A previously issued token replayed after rotation.", "IDENTITY"],
  ["DNS tunneling indicators", "Subdomain request pattern with unusually high entropy.", "NETWORK"],
  ["Snapshot shared externally", "Storage snapshot shared outside the organisation boundary.", "CLOUD"],
  ["Macro enabled document opened", "Office document executed an embedded macro on a laptop.", "EDR"],
  ["Rate limit exceeded on auth route", "Authentication route saturated by a single source.", "NETWORK"],
  ["MFA fatigue pattern", "Repeated push prompts delivered to one enrolled device.", "IDENTITY"],
  ["Log forwarder stopped shipping", "Security log pipeline stopped forwarding for 7 minutes.", "MANUAL"],
];

const NOTE_BODIES = [
  ["Initial triage — scope confirmed small", "Reviewed the first alert window. Scope appears limited to two hosts in the demo environment. Timeline reconstructed from simulated telemetry only; no production systems are involved in this exercise."],
  ["Source address clustering", "Grouped the observed source addresses into three clusters. Two clusters map to anonymised demo ranges, one is an artefact of the simulator. Next step is to correlate against the asset inventory."],
  ["Endpoint evidence", "Collected process and persistence artefacts from the affected demo workstation. Nothing destructive found; the sequence is consistent with the simulated scenario written for this exercise."],
  ["Identity correlation", "Correlated sign-in attempts with the demo identity provider export. All accounts belong to the fictional seeded team. No real identities are referenced."],
  ["Configuration diff reviewed", "Diffed the resource policy against the approved baseline. A single field changed outside the change window. Reverted in the simulation and recorded as a finding."],
  ["Containment step", "Isolated the affected simulated asset from the demo network segment. Verified that downstream services in the simulation continue to report healthy."],
  ["Owner interview notes", "Spoke with the fictional asset owner named in the seeded record. Their account of the change matches the configuration diff timeline."],
  ["Detection gap identified", "The current simulated rule set would not have caught the second stage. Recommended a new correlation rule and a regression test in the detection catalogue."],
  ["Timeline reconstruction", "Built a minute-by-minute timeline from the simulated alert stream. Three events share a common origin timestamp and are likely one sequence."],
  ["False positive analysis", "Reviewed similar events from the last simulated 30 days. Roughly half share this signature, suggesting the tuning threshold needs raising."],
  ["Remediation plan", "Agreed a three-step remediation: rotate the demo credential, tighten the policy, and add an alert on recurrence. Tasks created and assigned in this workspace."],
  ["Post-change verification", "Re-ran the verification query after the simulated fix. The signal has not recurred in the seeded window."],
];

const TASK_ROWS: [string, string, "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE", number][] = [
  ["Rotate demo service account credential", "Regenerate the simulated key and retire the old material.", "CRITICAL", "IN_PROGRESS", 3],
  ["Tune brute-force detection threshold", "Raise the trigger threshold to reduce simulated noise.", "HIGH", "IN_PROGRESS", 6],
  ["Revert object ACL to private", "Restore the approved baseline policy on the simulated bucket.", "CRITICAL", "DONE", 1],
  ["Collect endpoint triage bundle", "Pull the simulated triage package from the two affected hosts.", "HIGH", "DONE", 2],
  ["Draft containment checklist", "Write the repeatable checklist used for this scenario.", "MEDIUM", "TODO", 10],
  ["Review firewall rule baseline", "Confirm the simulated ingress rules match the documented baseline.", "HIGH", "BLOCKED", 4],
  ["Add regression test for the new rule", "Cover the detection rule with a seeded test case.", "MEDIUM", "TODO", 7],
  ["Interview asset owner", "Capture the fictional owner's account of the change.", "LOW", "DONE", 1],
  ["Verify replica lag recovery", "Confirm the simulated replica has caught up.", "MEDIUM", "DONE", 1],
  ["Revoke stale session tokens", "Force re-authentication for the seeded session set.", "HIGH", "IN_PROGRESS", 2],
  ["Document detection gap", "Record the gap and the proposed correlation logic.", "MEDIUM", "TODO", 5],
  ["Scan container registry allow list", "Remove the unapproved mirror from the simulated config.", "HIGH", "TODO", 3],
  ["Restore backup verification job", "Fix the simulated job and confirm a clean restore test.", "CRITICAL", "IN_PROGRESS", 2],
  ["Revoke privileged group membership", "Remove the unapproved simulated membership change.", "CRITICAL", "DONE", 1],
  ["Update incident runbook", "Reflect the new containment steps in the runbook.", "MEDIUM", "TODO", 8],
  ["Enable verbose audit on identity API", "Turn on the extra simulated audit fields.", "LOW", "TODO", 9],
  ["Notify simulated stakeholders", "Send the internal demo summary to the fictional distribution list.", "MEDIUM", "BLOCKED", 3],
  ["Retire legacy cipher configuration", "Remove deprecated suites from the simulated listener.", "HIGH", "IN_PROGRESS", 4],
  ["Purge cached records after logout", "Verify the staging cache invalidation path.", "HIGH", "DONE", 1],
  ["Baseline egress volumes", "Capture a fresh simulated 30-day egress baseline.", "MEDIUM", "TODO", 6],
  ["Harden workstation build image", "Apply the simulated hardening profile to new builds.", "LOW", "TODO", 12],
  ["Add alert for agent service stop", "Create a new simulated detection for service stops.", "HIGH", "TODO", 5],
  ["Run tabletop exercise", "Facilitate the simulated response walkthrough.", "MEDIUM", "TODO", 14],
  ["Close out false positive review", "Summarise tuning outcomes for the simulated queue.", "LOW", "DONE", 2],
  ["Confirm MFA re-enrolment", "Verify the seeded accounts re-enrolled successfully.", "HIGH", "IN_PROGRESS", 2],
  ["Archive completed investigation notes", "Move settled simulated notes into the archive view.", "LOW", "TODO", 11],
  ["Validate log forwarder recovery", "Confirm the simulated pipeline resumed shipping.", "MEDIUM", "DONE", 1],
  ["Approve remediation change record", "Sign off the simulated change in the workspace.", "HIGH", "BLOCKED", 4],
  ["Re-test partner API handshake", "Confirm the simulated endpoint negotiates approved suites.", "MEDIUM", "TODO", 7],
  ["Publish the demo data notice", "Keep the simulated-data disclosure visible in the workspace.", "LOW", "DONE", 1],
];

async function main() {
  if (process.env.DEMO_SEED !== "true") {
    throw new Error(
      'Refusing to run the destructive demo seed. Set DEMO_SEED=true explicitly before running the seed script.',
    );
  }

  console.log("Seeding CYBERDESK with FICTIONAL demo data…");

  // Reset (dependency order).
  await db.delete(activityLogs);
  await db.delete(sessions);
  await db.delete(incidentAssets);
  await db.delete(investigationNotes);
  await db.delete(tasks);
  await db.delete(alerts);
  await db.delete(incidents);
  await db.delete(assets);
  await db.delete(users);

  // Restart identity sequences so re-seeding produces stable, predictable ids.
  for (const seq of [
    "users_id_seq",
    "sessions_id_seq",
    "password_resets_id_seq",
    "assets_id_seq",
    "incidents_id_seq",
    "alerts_id_seq",
    "investigation_notes_id_seq",
    "tasks_id_seq",
    "activity_logs_id_seq",
  ]) {
    await db.execute(sql`alter sequence ${sql.raw(seq)} restart with 1`);
  }

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const insertedUsers = await db
    .insert(users)
    .values(
      TEAM.map((t, i) => ({
        name: t.name,
        email: t.email,
        passwordHash,
        role: t.role,
        title: t.title,
        status: "ACTIVE" as const,
        createdAt: ago(200 - i * 12),
        updatedAt: ago(30 - i),
      })),
    )
    .returning();
  const byEmail = new Map(insertedUsers.map((u) => [u.email, u]));
  const U = (idx: number) => insertedUsers[idx].id;
  const analystIds = [U(1), U(2), U(3), U(4)];

  const insertedAssets = await db
    .insert(assets)
    .values(
      ASSET_ROWS.map((a, i) => ({
        key: `AST-${String(i + 1).padStart(4, "0")}`,
        name: a[0],
        type: a[2],
        ipAddress: a[3],
        environment: a[4],
        status: a[5],
        ownerId: U(i % TEAM.length),
        lastSeen: ago(0, i % 18),
        createdAt: ago(150 - i * 3),
        updatedAt: ago(i % 9),
      })),
    )
    .returning();

  const insertedIncidents = await db
    .insert(incidents)
    .values(
      INCIDENT_ROWS.map((row, i) => ({
        key: `INC-${String(i + 1).padStart(4, "0")}`,
        title: row[0],
        description:
          `Simulated demonstration scenario ${i + 1}. This record was generated by the CYBERDESK seed script and does not describe a real security event, real system or real organisation.\n\nObserved in the simulation: ${row[0].toLowerCase()}. Analysts are expected to reconstruct a timeline from the linked alerts, record findings as investigation notes, and drive the linked tasks to completion.`,
        severity: row[1],
        status: row[2],
        assigneeId: analystIds[i % analystIds.length],
        createdById: U(0),
        tags: row[4].join(", "),
        createdAt: ago(28 - i * 1.5, i),
        updatedAt: ago(i % 6, i % 9),
      })),
    )
    .returning();

  await db.insert(incidentAssets).values(
    insertedIncidents.flatMap((inc, i) => {
      const first = ASSET_ROWS[i % ASSET_ROWS.length];
      const second = ASSET_ROWS[(i * 5 + 3) % ASSET_ROWS.length];
      const ids = [insertedAssets.find((a) => a.name === first[0])!.id];
      if (first !== second) ids.push(insertedAssets.find((a) => a.name === second[0])!.id);
      return [...new Set(ids)].map((assetId) => ({ incidentId: inc.id, assetId }));
    }),
  );

  const insertedAlerts = await db
    .insert(alerts)
    .values(
      ALERT_TITLES.map((a, i) => {
        const severity = (["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const)[i % 4 === 0 ? 0 : i % 3 === 0 ? 1 : i % 2 === 0 ? 2 : 3];
        const status = (["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED"] as const)[i % 4];
        const linked = i % 5 === 4 ? null : insertedIncidents[i % insertedIncidents.length].id;
        return {
          key: `ALT-${String(i + 1).padStart(4, "0")}`,
          title: a[0],
          detail: `${a[1]} (Simulated demo alert — not real telemetry.)`,
          source: a[2],
          severity,
          status,
          detectedAt: ago(i % 26, (i * 3) % 23),
          incidentId: linked,
          createdAt: ago(i % 26),
          updatedAt: ago(i % 5),
        };
      }),
    )
    .returning();

  const noteValues = [];
  for (let i = 0; i < 26; i++) {
    const inc = insertedIncidents[i % insertedIncidents.length];
    const [t, b] = NOTE_BODIES[i % NOTE_BODIES.length];
    noteValues.push({
      title: `${t} — ${inc.key}`,
      body: `${b}\n\nEntry ${i + 1} of the simulated investigation log for ${inc.key}.`,
      incidentId: inc.id,
      authorId: analystIds[i % analystIds.length],
      createdAt: ago(20 - i * 0.7, i % 8),
      updatedAt: ago(i % 4),
    });
  }
  const insertedNotes = await db.insert(investigationNotes).values(noteValues).returning();

  const insertedTasks = await db
    .insert(tasks)
    .values(
      TASK_ROWS.map((t, i) => {
        const inc = insertedIncidents[i % insertedIncidents.length];
        const due = new Date(now + ((i % 11) - 3) * DAY);
        return {
          key: `TSK-${String(i + 1).padStart(4, "0")}`,
          title: t[0],
          description: `${t[1]} (Simulated demo task.)`,
          incidentId: inc.id,
          assigneeId: analystIds[i % analystIds.length],
          priority: t[2],
          status: t[3],
          dueDate: `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`,
          createdAt: ago(18 - i * 0.5, i),
          updatedAt: ago(i % 5),
        };
      }),
    )
    .returning();

  // Activity log: generated from the records above so the timeline is coherent.
  const logs: (typeof activityLogs.$inferInsert)[] = [];
  insertedIncidents.forEach((inc, i) => {
    logs.push({
      actorId: U(0),
      actorName: insertedUsers[0].name,
      action: "incident.created",
      entityType: "incident",
      entityId: inc.id,
      entityKey: inc.key,
      summary: `${insertedUsers[0].name} opened ${inc.key} — “${inc.title.slice(0, 60)}…”`,
      createdAt: inc.createdAt,
    });
    logs.push({
      actorId: inc.assigneeId,
      actorName: insertedUsers.find((u) => u.id === inc.assigneeId)?.name ?? "Analyst",
      action: "incident.updated",
      entityType: "incident",
      entityId: inc.id,
      entityKey: inc.key,
      summary: `${insertedUsers.find((u) => u.id === inc.assigneeId)?.name ?? "Analyst"} set ${inc.key} status to ${inc.status.toLowerCase().replace("_", " ")}`,
      createdAt: inc.updatedAt,
    });
  });
  insertedAlerts.slice(0, 16).forEach((a) => {
    logs.push({
      actorId: analystIds[a.id % analystIds.length],
      actorName: insertedUsers.find((u) => u.id === analystIds[a.id % analystIds.length])!.name,
      action: a.status === "NEW" ? "alert.created" : "alert.updated",
      entityType: "alert",
      entityId: a.id,
      entityKey: a.key,
      summary: `${insertedUsers.find((u) => u.id === analystIds[a.id % analystIds.length])!.name} ${a.status === "NEW" ? "recorded" : "updated"} ${a.key} — status ${a.status.toLowerCase()}`,
      createdAt: a.detectedAt,
    });
  });
  insertedTasks.forEach((t) => {
    logs.push({
      actorId: t.assigneeId,
      actorName: insertedUsers.find((u) => u.id === t.assigneeId)?.name ?? "Analyst",
      action: t.status === "DONE" ? "task.completed" : "task.created",
      entityType: "task",
      entityId: t.id,
      entityKey: t.key,
      summary: `${insertedUsers.find((u) => u.id === t.assigneeId)?.name ?? "Analyst"} ${t.status === "DONE" ? "completed" : "created"} ${t.key} — ${t.title}`,
      createdAt: t.status === "DONE" ? t.updatedAt : t.createdAt,
    });
  });
  insertedNotes.forEach((n) => {
    logs.push({
      actorId: n.authorId,
      actorName: insertedUsers.find((u) => u.id === n.authorId)?.name ?? "Analyst",
      action: "note.created",
      entityType: "note",
      entityId: n.id,
      entityKey: insertedIncidents.find((i) => i.id === n.incidentId)?.key ?? null,
      summary: `${insertedUsers.find((u) => u.id === n.authorId)?.name ?? "Analyst"} added an investigation note — “${n.title.slice(0, 50)}…”`,
      createdAt: n.createdAt,
    });
  });
  insertedAssets.slice(0, 8).forEach((a) => {
    logs.push({
      actorId: U(0),
      actorName: insertedUsers[0].name,
      action: "asset.created",
      entityType: "asset",
      entityId: a.id,
      entityKey: a.key,
      summary: `${insertedUsers[0].name} added asset ${a.key} — ${a.name}`,
      createdAt: a.createdAt,
    });
  });
  await db.insert(activityLogs).values(logs);

  console.log(`
CYBERDESK seed complete — ALL DATA IS FICTIONAL / SIMULATED.
  users                ${insertedUsers.length}
  assets               ${insertedAssets.length}
  incidents            ${insertedIncidents.length}
  incident↔asset links ${(await db.select({ id: incidentAssets.assetId }).from(incidentAssets)).length}
  alerts               ${insertedAlerts.length}
  investigation notes  ${insertedNotes.length}
  tasks                ${insertedTasks.length}
  activity logs        ${logs.length}

Demo sign-in (fictional, demo-only): ${TEAM[0].email} / ${DEMO_PASSWORD}
Other seeded accounts share the same password and use the emails above.
`);
  void byEmail;
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
