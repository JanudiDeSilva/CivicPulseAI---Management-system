import express from "express";
import { v4 as uuidv4 } from "uuid";
import { Report, ReportImage } from "../models/index.js";
import { triage } from "../services/triage.js";
import {
    getFloodRiskFromComplaint,
    predictGarbage,
    predictRoadDamage,
    getGarbageModelStatus,
    getRoadDamageModelStatus,
} from "../services/floodRiskClient.js";
import { upload } from "../middleware/upload.js";
import { categoryLabel, categoryIcon, humanizeTime } from "../utils/helpers.js";

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findReportByIdOrTracking(param) {
    const include = [{ model: ReportImage, as: "images" }];
    if (UUID_RE.test(param)) {
        return Report.findByPk(param, { include });
    }
    return Report.findOne({ where: { tracking_id: param }, include });
}

function formatReportResponse(report) {
    const normalizeImageUrl = (value) => {
        if (!value) return null;
        if (value.startsWith("http://") || value.startsWith("https://")) return value;
        const base = process.env.ML_SERVICE_URL || "http://127.0.0.1:8001";
        return `${base}${value.startsWith("/") ? value : `/${value}`}`;
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
        images: (report.images || []).map((img) => ({
            id: img.id,
            url: img.image_url,
            ml_analysis: img.ml_analysis || null,
        })),
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
        include: [{ model: ReportImage, as: "images" }],
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
    await report.save();
    res.json({
        id: report.id,
        tracking_id: report.tracking_id,
        status: report.status,
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
        const result = await predictGarbage(req.file.buffer, req.file.originalname, req.file.mimetype);
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
        const category = req.body.category || "pothole";
        const result = await predictRoadDamage(req.file.buffer, req.file.originalname, req.file.mimetype, category);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: "Failed to process image", detail: err.message });
    }
});

export default router;