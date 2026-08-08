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
        severity: report.severity,
        priority_score: report.priority_score,
        status: report.status,
        admin_reply: report.admin_reply || null,
        predicted_escalation: report.predicted_escalation,
        escalation_confidence: report.escalation_confidence,
        source: report.source,
        latitude: report.latitude,
        longitude: report.longitude,
        submitted_at: humanizeTime(report.created_at),
        created_at: report.created_at,
    };
}

// ─── POST /predict ──────────────────────────────────────────────────────────
router.post("/predict", upload.single("photo"), async (req, res) => {
    try {
        const {
            source = "web", name, phone, category, description,
            specific_details, district, city, area, latitude, longitude,
        } = req.body;

        const shortId = uuidv4().replace(/-/g, "").slice(0, 6);
        const trackingId = `CP-${shortId}`;

        let severity, priorityScore, predictedEscalation, escalationConfidence;

        if (category === "flood") {
            const floodRisk = await getFloodRiskFromComplaint({
                district, place_name: area || city, latitude, longitude
            });
            if (floodRisk) {
                severity = floodRisk.risk_level === "HIGH" ? "CRITICAL" : floodRisk.risk_level === "MODERATE" ? "HIGH" : "MEDIUM";
                priorityScore = floodRisk.flood_probability;
                predictedEscalation = floodRisk.flood_occurrence === "yes" ? "YES" : "NO";
                escalationConfidence = floodRisk.confidence;
            } else {
                const triageResult = triage({ category, rawText: description, specificDetails: specific_details });
                severity = triageResult.severity;
                priorityScore = triageResult.priorityScore;
                predictedEscalation = triageResult.predictedEscalation;
                escalationConfidence = triageResult.escalationConfidence;
            }
        } else {
            const triageResult = triage({ category, rawText: description, specificDetails: specific_details });
            severity = triageResult.severity;
            priorityScore = triageResult.priorityScore;
            predictedEscalation = triageResult.predictedEscalation;
            escalationConfidence = triageResult.escalationConfidence;
        }

        let status;
        if (severity === "CRITICAL") status = "Dispatched";
        else if (severity === "HIGH") status = "Under Review";
        else status = "Registered";

        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const report = await Report.create({
            tracking_id: trackingId,
            source, name, phone, category,
            raw_text: description,
            specific_details,
            image_url: imageUrl,
            district, city, area,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            severity,
            severity_raw: severity,
            priority_score: priorityScore,
            predicted_escalation: predictedEscalation,
            escalation_confidence: escalationConfidence,
            status,
        });

        res.json({
            id: report.id,
            tracking_id: report.tracking_id,
            severity,
            priority_score: priorityScore,
            status,
            predicted_escalation: predictedEscalation,
            escalation_confidence: escalationConfidence,
            message: "Complaint registered and triaged successfully",
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ detail: `Database error: ${err.message}` });
    }
});

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

// ─── GET /reports/:id ───────────────────────────────────────────────────────
router.get("/reports/:id", async (req, res) => {
    const report = await findReportByIdOrTracking(req.params.id);
    if (!report) return res.status(404).json({ detail: "Report not found" });

    res.json(formatReportResponse(report));
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