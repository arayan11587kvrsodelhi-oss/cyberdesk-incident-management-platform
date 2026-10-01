import { count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLogs,
  alerts,
  assets,
  incidents,
  investigationNotes,
  tasks,
  users,
} from "@/db/schema";

/**
 * Every number on the dashboard is aggregated from PostgreSQL at request time.
 * Nothing here is hardcoded or estimated.
 */
export async function getDashboardStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    openIncidents,
    criticalAlerts,
    monitoredAssets,
    activeTasks,
    incidentBySeverity,
    incidentByStatus,
    alertBySource,
    alertByDay,
    assetHealth,
    recentActivity,
    openByAssignee,
    unassignedAlerts,
    incidentsTrend,
    alertsTrend,
    noteCount,
  ] = await Promise.all([
    db
      .select({ n: count() })
      .from(incidents)
      .where(sql`${incidents.status} in ('OPEN','INVESTIGATING','CONTAINED')`),
    db.select({ n: count() }).from(alerts).where(sql`${alerts.severity} = 'CRITICAL' and ${alerts.status} != 'RESOLVED'`),
    db.select({ n: count() }).from(assets),
    db.select({ n: count() }).from(tasks).where(sql`${tasks.status} != 'DONE'`),
    db.select({ severity: incidents.severity, n: count() }).from(incidents).groupBy(incidents.severity),
    db.select({ status: incidents.status, n: count() }).from(incidents).groupBy(incidents.status),
    db.select({ source: alerts.source, n: count() }).from(alerts).groupBy(alerts.source),
    db
      .select({
        bucket: sql<string>`to_char(date_trunc('day', ${alerts.detectedAt}), 'YYYY-MM-DD')`,
        n: count(),
      })
      .from(alerts)
      .where(gte(alerts.detectedAt, thirtyDaysAgo))
      .groupBy(sql`date_trunc('day', ${alerts.detectedAt})`)
      .orderBy(sql`date_trunc('day', ${alerts.detectedAt})`),
    db.select({ status: assets.status, n: count() }).from(assets).groupBy(assets.status),
    db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        summary: activityLogs.summary,
        actorName: activityLogs.actorName,
        entityType: activityLogs.entityType,
        entityKey: activityLogs.entityKey,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(8),
    db
      .select({ name: users.name, n: count() })
      .from(incidents)
      .innerJoin(users, eq(incidents.assigneeId, users.id))
      .where(sql`${incidents.status} in ('OPEN','INVESTIGATING','CONTAINED')`)
      .groupBy(users.name)
      .orderBy(desc(count()))
      .limit(5),
    db.select({ n: count() }).from(alerts).where(sql`${alerts.status} = 'NEW'`),
    db
      .select({ n: count() })
      .from(incidents)
      .where(sql`${incidents.status} in ('OPEN','INVESTIGATING','CONTAINED') and ${incidents.createdAt} < ${thirtyDaysAgo}`),
    db.select({ n: count() }).from(alerts).where(gte(alerts.detectedAt, thirtyDaysAgo)),
    db.select({ n: count() }).from(investigationNotes),
  ]);

  const totalIncidents = incidentBySeverity.reduce((sum, r) => sum + r.n, 0);
  const totalAlerts = alertBySource.reduce((sum, r) => sum + r.n, 0);
  const totalAssets = assetHealth.reduce((sum, r) => sum + r.n, 0);

  // 14 day alert activity series (fill gaps so the chart has a real x-axis)
  const series: { day: string; n: number }[] = [];
  const byDay = new Map(alertByDay.map((r) => [r.bucket, r.n]));
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    series.push({ day: key, n: byDay.get(key) ?? 0 });
  }

  const activeIncidents = openIncidents[0]?.n ?? 0;
  const prevActive = incidentsTrend[0]?.n ?? 0;

  return {
    kpis: {
      openIncidents: activeIncidents,
      criticalAlerts: criticalAlerts[0]?.n ?? 0,
      monitoredAssets: monitoredAssets[0]?.n ?? 0,
      activeTasks: activeTasks[0]?.n ?? 0,
      newAlerts30d: alertsTrend[0]?.n ?? 0,
      unacknowledgedAlerts: unassignedAlerts[0]?.n ?? 0,
      openIncidentDelta: prevActive - activeIncidents,
      totalIncidents,
      totalAlerts,
      totalAssets,
      noteCount: noteCount[0]?.n ?? 0,
    },
    severityDistribution: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((s) => ({
      severity: s,
      n: incidentBySeverity.find((r) => r.severity === s)?.n ?? 0,
    })),
    statusBreakdown: ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "CLOSED"].map((s) => ({
      status: s,
      n: incidentByStatus.find((r) => r.status === s)?.n ?? 0,
    })),
    alertSourceBreakdown: alertBySource.map((r) => ({ source: r.source, n: r.n })),
    alertActivity: series,
    assetHealth: ["HEALTHY", "WARNING", "CRITICAL", "OFFLINE"].map((s) => ({
      status: s,
      n: assetHealth.find((r) => r.status === s)?.n ?? 0,
    })),
    workload: openByAssignee,
    recentActivity,
  };
}
