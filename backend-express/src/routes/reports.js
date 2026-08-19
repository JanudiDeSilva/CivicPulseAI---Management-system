import express from "express";
import { v4 as uuidv4 } from "uuid";
import { Report } from "../models/index.js";
import { triage } from "../services/triage.js";
import {
    getFloodRiskFromComplaint,
    predictGarbage,
    predictRoadDamage,
    getGarbageModelStatus,
    getRoadDamageModelStatus,
} from "../services/floodRiskClient.js";
import fs from "fs";
import { upload } from "../middleware/upload.js";
import { categoryLabel, categoryIcon, humanizeTime } from "../utils/helpers.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findReportByIdOrTracking(param) {
    if (UUID_RE.test(param)) {
        return Report.findByPk(param);
    }
    return Report.findOne({ where: { tracking_id: param } });
}

function formatReportResponse(report) {
    const normalizeImageUrl = (value) => {
        if (!value) return null;
        if (value.startsWith("http://") || value.startsWith("https://")) return value;
        return `http://127.0.0.1:8000${value.startsWith("/") ? value : `/${value}`}`;
    };

    const reportImageUrl = normalizeImageUrl(report.image_url);
    const ml = report.ml_analysis || {};
    const risk = report.risk_signals || {};
    const severityFromModel = (() => {
        const direct = ml?.risk_level || ml?.severity || risk?.floodRisk?.risk_level;
        if (direct) return String(direct).toUpperCase();
        if (ml?.confidence != null) {
            const value = Number(ml.confidence);
            if (value >= 0.8) return "HIGH";
            if (value >= 0.5) return "MEDIUM";
            return "LOW";
        }
        if (ml?.image_damage_score != null) {
            const value = Number(ml.image_damage_score);
            if (value >= 3) return "HIGH";
            if (value >= 1.5) return "MEDIUM";
            return "LOW";
        }
        return null;
    })();

    const priorityFromModel = (() => {
        const direct = ml?.flood_probability ?? ml?.confidence ?? risk?.floodRisk?.flood_probability ?? risk?.floodRisk?.confidence;
        if (typeof direct === "number") return Math.min(Math.max(Number(direct), 0), 1);
        if (ml?.image_damage_score != null) {
            return Math.min(Math.max(Number(ml.image_damage_score) / 10, 0.15), 0.95);
        }
        return null;
    })();

    const displaySeverity = report.severity || severityFromModel || "PENDING";
    const displayPriority = report.priority_score ?? priorityFromModel ?? 0;

    return {
        id: report.id,
        tracking_id: report.tracking_id,
        name: report.name,
        phone: report.phone,
        category: report.category,
        category_label: categoryLabel(report.category),
        icon: categoryIcon(report.category),
        district: report.district,
        city: report.city,
        area: report.area,
        description: report.raw_text,
        specific_details: report.specific_details,
        image_url: reportImageUrl,
        photo_url: reportImageUrl,
        ml_analysis: report.ml_analysis || null,
        risk_signals: report.risk_signals || null,
        severity: displaySeverity,
        priority_score: displayPriority,
        severity_score: report.severity_score || displayPriority,
        status: report.status,
        admin_reply: report.admin_reply || null,
        predicted_escalation: report.predicted_escalation,
        escalation_confidence: report.escalation_confidence,
        source: report.source,
        latitude: report.latitude,
        longitude: report.longitude,
        elevation_m: report.elevation_m,
        distance_to_river_m: report.distance_to_river_m,
        population_density_per_km2: report.population_density_per_km2,
        built_up_percent: report.built_up_percent,
        rainfall_7d_mm: report.rainfall_7d_mm,
        monthly_rainfall_mm: report.monthly_rainfall_mm,
        ndvi: report.ndvi,
        ndwi: report.ndwi,
        water_presence_flag: report.water_presence_flag,
        historical_flood_count: report.historical_flood_count,
        infrastructure_score: report.infrastructure_score,
        nearest_hospital_km: report.nearest_hospital_km,
        nearest_evac_km: report.nearest_evac_km,
        submitted_at: humanizeTime(report.created_at),
        created_at: report.created_at,
        resolved_at: report.resolved_at || null,
        resolution_duration_ms: (() => {
            if (report.status !== "Resolved" && report.status !== "Closed") return null;
            const created = report.created_at ? new Date(report.created_at).getTime() : null;
            const resolved = report.resolved_at ? new Date(report.resolved_at).getTime() : (report.updated_at ? new Date(report.updated_at).getTime() : null);
            if (created && resolved && resolved >= created) return resolved - created;
            return null;
        })(),
        resolution_time_display: (() => {
            if (report.status !== "Resolved" && report.status !== "Closed") return null;
            const created = report.created_at ? new Date(report.created_at).getTime() : null;
            const resolved = report.resolved_at ? new Date(report.resolved_at).getTime() : (report.updated_at ? new Date(report.updated_at).getTime() : null);
            if (created && resolved && resolved >= created) {
                const diff = resolved - created;
                const hours = diff / 3600000;
                if (hours < 1) return `${Math.max(Math.round(diff / 60000), 1)}m`;
                if (hours < 24) return `${hours.toFixed(1)}h`;
                return `${(hours / 24).toFixed(1)}d`;
            }
            return null;
        })(),
    };
}

// ─── GET /reports ───────────────────────────────────────────────────────────
router.get("/reports", async (req, res) => {
    const { category, severity, status, limit = 100, offset = 0 } = req.query;
    const where = {};
    if (category) where.category = category;
    if (severity) where.severity = severity;
    if (status) where.status = status;

    const { count, rows } = await Report.findAndCountAll({
        where,
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: parseInt(offset),
    });

    const result = rows.map((r) => formatReportResponse(r));

    res.json({ reports: result, total: count });
});

// ─── POST /reports/sync ─────────────────────────────────────────────────────
router.post("/reports/sync", async (req, res) => {
    const { identifiers = [] } = req.body;
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
        return res.status(400).json({ detail: "identifiers array is required" });
    }

    const reports = [];
    for (const identifier of identifiers) {
        const report = await findReportByIdOrTracking(String(identifier));
        if (report) reports.push(formatReportResponse(report));
    }

    res.json({ reports });
});

// ─── POST /reports/track-guest ──────────────────────────────────────────────
router.post("/reports/track-guest", async (req, res) => {
    const { tracking_id, phone } = req.body;
    if (!tracking_id || !phone) {
        return res.status(400).json({ detail: "Both Complaint ID and Mobile Number are required to track." });
    }

    const report = await findReportByIdOrTracking(String(tracking_id).trim());
    if (!report) {
        return res.status(404).json({ detail: "No complaint found with this Complaint ID." });
    }

    const cleanReqPhone = String(phone).replace(/\D/g, "");
    const cleanRepPhone = String(report.phone || "").replace(/\D/g, "");

    const phoneMatches = cleanReqPhone && cleanRepPhone && (
        cleanRepPhone.endsWith(cleanReqPhone) ||
        cleanReqPhone.endsWith(cleanRepPhone) ||
        cleanReqPhone.slice(-7) === cleanRepPhone.slice(-7)
    );

    if (!phoneMatches) {
        return res.status(403).json({ detail: "The mobile number provided does not match the registered contact for this complaint." });
    }

    res.json({ report: formatReportResponse(report) });
});

// ─── GET /reports/by-phone/:phone ───────────────────────────────────────────
router.get("/reports/by-phone/:phone", async (req, res) => {
    const rawPhone = req.params.phone;
    const cleanPhone = String(rawPhone).replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 5) {
        return res.status(400).json({ detail: "Valid phone number required." });
    }

    const allReports = await Report.findAll({ order: [["created_at", "DESC"]] });
    const matched = allReports.filter(r => {
        const repClean = String(r.phone || "").replace(/\D/g, "");
        return repClean && (repClean.endsWith(cleanPhone) || cleanPhone.endsWith(repClean) || cleanPhone.slice(-7) === repClean.slice(-7));
    });

    res.json({ reports: matched.map(r => formatReportResponse(r)) });
});

// ─── GET /reports/:id ───────────────────────────────────────────────────────
router.get("/reports/:id", async (req, res) => {
    const report = await findReportByIdOrTracking(req.params.id);
    if (!report) return res.status(404).json({ detail: "Report not found" });

    res.json(formatReportResponse(report));
});

// ─── DELETE /reports/:id ────────────────────────────────────────────────────
router.delete("/reports/:id", async (req, res) => {
    const report = await findReportByIdOrTracking(req.params.id);
    if (!report) return res.status(404).json({ detail: "Report not found" });

    await report.destroy();
    res.json({ message: "Report deleted successfully" });
});

// ─── PATCH /reports/:id/status ──────────────────────────────────────────────
router.patch("/reports/:id/status", async (req, res) => {
    const { status } = req.body;
    const validStatuses = ["Registered", "Under Review", "Dispatched", "Resolved", "Closed"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ detail: `Status must be one of: ${validStatuses}` });
    }

    const report = await findReportByIdOrTracking(req.params.id);
    if (!report) return res.status(404).json({ detail: "Report not found" });

    report.status = status;
    if (status === "Resolved" || status === "Closed") {
        if (!report.resolved_at) report.resolved_at = new Date();
    } else {
        report.resolved_at = null;
    }
    await report.save();
    res.json({
        id: report.id,
        tracking_id: report.tracking_id,
        status: report.status,
        resolved_at: report.resolved_at || null,
        message: "Status updated",
    });
});

// ─── PATCH /reports/:id/reply ───────────────────────────────────────────────
router.patch("/reports/:id/reply", async (req, res) => {
    const { reply } = req.body;
    if (reply === undefined) {
        return res.status(400).json({ detail: "reply field is required" });
    }

    const report = await findReportByIdOrTracking(req.params.id);
    if (!report) return res.status(404).json({ detail: "Report not found" });

    if (report.admin_reply) {
        return res.status(400).json({ detail: "Reply has already been sent and cannot be modified" });
    }

    report.admin_reply = reply;
    await report.save();
    res.json({
        id: report.id,
        tracking_id: report.tracking_id,
        admin_reply: report.admin_reply,
        message: "Reply saved",
    });
});

// ─── ML SERVICE PROXY ROUTES ────────────────────────────────────────────────
router.get("/garbage-model-status", async (req, res) => {
    const status = await getGarbageModelStatus();
    res.json(status);
});

router.post("/predict-garbage", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file uploaded" });
        }
        const fileBuffer = fs.readFileSync(req.file.path);
        const result = await predictGarbage(fileBuffer, req.file.originalname, req.file.mimetype);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed to process image", detail: err.message });
    }
});

router.get("/road-damage-model-status", async (req, res) => {
    const status = await getRoadDamageModelStatus();
    res.json(status);
});

router.post("/predict-road-damage", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file uploaded" });
        }
        const fileBuffer = fs.readFileSync(req.file.path);
        const category = req.body.category || "pothole";
        const result = await predictRoadDamage(fileBuffer, req.file.originalname, req.file.mimetype, category);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed to process image", detail: err.message });
    }
});

export default router;