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

    res.json({
        total_reports: total,
        critical_high_count: criticalHigh,
        resolved_count: resolved,
        open_count: open,
        districts_covered,
        resolved_percent: resolvedPercent,
        by_category, by_severity, by_status,
    });
});

export default router;