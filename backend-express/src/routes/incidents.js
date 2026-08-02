import express from "express";
import { Incident } from "../models/index.js";

const router = express.Router();

router.get("/incidents", async (_req, res) => {
    const incidents = await Incident.findAll({ order: [["last_reported_at", "DESC"]] });
    res.json({
        incidents: incidents.map((i) => ({
            id: i.id,
            category: i.category,
            report_count: i.report_count,
            priority: i.priority,
            priority_score: i.priority_score,
            status: i.status,
            predicted_escalation: i.predicted_escalation,
            first_reported_at: i.first_reported_at,
            last_reported_at: i.last_reported_at,
        })),
    });
});

export default router;