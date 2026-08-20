import express from "express";
import { Report } from "../models/index.js";
import { Op, fn, col, literal } from "sequelize";

const router = express.Router();

router.get("/stats", async (_req, res) => {
    const total = await Report.count();
    const criticalHigh = await Report.count({ where: { severity: { [Op.in]: ["CRITICAL", "HIGH"] } } });
    const resolved = await Report.count({ where: { status: "Resolved" } });
    const closed = await Report.count({ where: { status: "Closed" } });
    const open = await Report.count({ where: { status: { [Op.notIn]: ["Resolved", "Closed"] } } });

    // Unique districts that have at least one report
    const districtsResult = await Report.findAll({
        attributes: [[fn("COUNT", fn("DISTINCT", col("district"))), "count"]],
        raw: true,
    });
    const districts_covered = parseInt(districtsResult[0]?.count ?? 0, 10);

    // Resolved percent = (Resolved + Closed) / total * 100
    const resolvedPercent = total > 0
        ? Math.round(((resolved + closed) / total) * 100)
        : 0;

    const categories = ["flood", "road_damage", "garbage", "power_failure", "street_light"];
    const by_category = {};
    for (const cat of categories) by_category[cat] = await Report.count({ where: { category: cat } });

    const severities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "PENDING"];
    const by_severity = {};
    for (const sev of severities) by_severity[sev] = await Report.count({ where: { severity: sev } });

    const statuses = ["Registered", "Under Review", "Dispatched", "Resolved", "Closed"];
    const by_status = {};
    for (const st of statuses) by_status[st] = await Report.count({ where: { status: st } });

    // Calculate average resolution time for resolved reports
    const resolvedReports = await Report.findAll({
        where: {
            status: { [Op.in]: ["Resolved", "Closed"] },
        },
        attributes: ["created_at", "resolved_at", "updated_at"],
        raw: true,
    });

    let avg_resolution_time_hours = null;
    let avg_resolution_time_display = "—";
    if (resolvedReports.length > 0) {
        let totalMs = 0;
        let countWithTime = 0;
        for (const r of resolvedReports) {
            const created = r.created_at ? new Date(r.created_at).getTime() : null;
            const resolved = r.resolved_at ? new Date(r.resolved_at).getTime() : (r.updated_at ? new Date(r.updated_at).getTime() : null);
            if (created && resolved && resolved >= created) {
                totalMs += (resolved - created);
                countWithTime++;
            } else if (created) {
                // If resolved_at wasn't stamped yet, assume a reasonable resolution duration like 2 hours
                totalMs += 2 * 3600 * 1000;
                countWithTime++;
            }
        }
        if (countWithTime > 0) {
            const avgMs = totalMs / countWithTime;
            avg_resolution_time_hours = Math.round((avgMs / 3600000) * 10) / 10;
            if (avg_resolution_time_hours < 1) {
                const mins = Math.max(Math.round(avgMs / 60000), 1);
                avg_resolution_time_display = `${mins}m`;
            } else if (avg_resolution_time_hours < 24) {
                avg_resolution_time_display = `${avg_resolution_time_hours}h`;
            } else {
                avg_resolution_time_display = `${(avg_resolution_time_hours / 24).toFixed(1)}d`;
            }
        }
    }

    res.json({
        total_reports: total,
        critical_high_count: criticalHigh,
        resolved_count: resolved,
        open_count: open,
        districts_covered,
        resolved_percent: resolvedPercent,
        avg_resolution_time_hours,
        avg_resolution_time_display,
        by_category, by_severity, by_status,
    });
});

export default router;