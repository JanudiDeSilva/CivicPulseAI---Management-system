import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { Report } from '../models/index.js';
import { 
  getFloodRiskFromComplaint, 
  predictGarbage, 
  predictRoadDamage
} from '../services/floodRiskClient.js';
import { triage } from '../services/triage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Main prediction endpoint that processes complaints
router.post('/predict', upload.array('photos', 10), async (req, res) => {
  try {
    const { 
      category, 
      district, 
      city, 
      area, 
      latitude, 
      longitude, 
      raw_text,
      description,
      specific_details,
      tracking_id,
      name,
      phone,
      status
    } = req.body;

    const uploadedFiles = req.files || [];
    const firstFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;
    const finalRawText = raw_text || description || specific_details || '';

    let savedImageUrls = [];

    if (uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const ext = path.extname(file.originalname || '.jpg') || '.jpg';
        const savedFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        const filePath = path.join(uploadDir, savedFileName);
        fs.writeFileSync(filePath, file.buffer);
        savedImageUrls.push(`/uploads/${savedFileName}`);
      }
    }

    // Basic triage
    const triageResult = triage({
      category,
      rawText: finalRawText,
      specificDetails: specific_details || ''
    });

    let aiAnalysis = null;
    let floodRisk = null;

    // Get drainage & waterlogging triage assessment for flood/drainage complaints
    if (category === 'flood') {
      try {
        let parsedImpact = [];
        if (req.body.impact) {
          if (Array.isArray(req.body.impact)) {
            parsedImpact = req.body.impact;
          } else {
            try {
              parsedImpact = JSON.parse(req.body.impact);
            } catch (_) {
              parsedImpact = [req.body.impact];
            }
          }
        }

        floodRisk = await getFloodRiskFromComplaint({
          district,
          place_name: area || city,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          problem_type: req.body.problemType || req.body.problem_type || '',
          severity_waterlogging: req.body.severityWaterlogging || req.body.severity_waterlogging || '',
          water_status: req.body.waterStatus || req.body.water_status || '',
          duration: req.body.problemDuration || req.body.duration || '',
          impact: parsedImpact,
          description: finalRawText
        });
      } catch (error) {
        console.warn('Flood risk prediction failed:', error.message);
      }
    }

    // Run AI image analysis if image is provided
    if (firstFile && (category === 'garbage' || category === 'road_damage')) {
      try {
        if (category === 'garbage') {
          aiAnalysis = await predictGarbage(
            firstFile.buffer,
            firstFile.originalname,
            firstFile.mimetype
          );
        } else if (category === 'road_damage') {
          aiAnalysis = await predictRoadDamage(
            firstFile.buffer,
            firstFile.originalname,
            firstFile.mimetype,
            category
          );
        }
      } catch (error) {
        console.warn('AI image analysis failed:', error.message);
        aiAnalysis = { error: 'AI analysis failed', detail: error.message };
      }
    }

    // Enhance triage with AI results
    let enhancedTriage = { ...triageResult };
    let aiSeverity = enhancedTriage.severity;
    let aiPriorityScore = enhancedTriage.priorityScore;

    const deriveModelSeverity = (analysis, fallback = 'LOW') => {
      if (!analysis || analysis.error) return fallback;

      if (analysis.risk_level) return String(analysis.risk_level).toUpperCase();

      if (analysis.flood_probability != null) {
        const score = Number(analysis.flood_probability);
        if (score >= 0.7) return 'HIGH';
        if (score >= 0.35) return 'MEDIUM';
        return 'LOW';
      }

      const confidence = Number(analysis.confidence ?? 0);
      if (analysis.image_damage_score != null) {
        const score = Number(analysis.image_damage_score || 0);
        if (score >= 3 || confidence >= 0.7) return 'HIGH';
        if (score >= 1.5 || confidence >= 0.45) return 'MEDIUM';
        return 'LOW';
      }

      if (confidence >= 0.8) return 'HIGH';
      if (confidence >= 0.5) return 'MEDIUM';
      return 'LOW';
    };

    const deriveModelPriority = (analysis, fallback = 0.3) => {
      if (!analysis || analysis.error) return fallback;

      if (analysis.flood_probability != null) {
        return Number(Math.min(Math.max(Number(analysis.flood_probability), 0), 1).toFixed(2));
      }

      if (analysis.confidence != null) {
        return Number(Math.min(Math.max(Number(analysis.confidence), 0), 1).toFixed(2));
      }

      if (analysis.image_damage_score != null) {
        const score = Number(analysis.image_damage_score || 0);
        return Number(Math.min(Math.max(score / 10, 0.15), 0.95).toFixed(2));
      }

      return fallback;
    };

    if (category === 'flood' && floodRisk) {
      aiSeverity = floodRisk.severity || 'LOW';
      aiPriorityScore = Number(((floodRisk.priority_score || 50) / 100).toFixed(2));
      enhancedTriage.predictedEscalation = (floodRisk.escalation_flag === 'Yes' || floodRisk.escalation_flag === 'YES') ? 'YES' : 'NO';
      enhancedTriage.severity = aiSeverity;
      enhancedTriage.priorityScore = aiPriorityScore;
    } else {
      if (floodRisk && floodRisk.risk_level) {
        aiSeverity = String(floodRisk.risk_level).toUpperCase();
        aiPriorityScore = Math.max(aiPriorityScore, Number((floodRisk.flood_probability ?? 0.7).toFixed(2)));
      }

      if (aiAnalysis && !aiAnalysis.error) {
        const modelSeverity = deriveModelSeverity(aiAnalysis, aiSeverity);
        const modelPriority = deriveModelPriority(aiAnalysis, aiPriorityScore);
        aiSeverity = modelSeverity;
        aiPriorityScore = modelPriority;
      }

      if (floodRisk && floodRisk.risk_level === 'HIGH') {
        aiSeverity = 'CRITICAL';
        aiPriorityScore = 0.95;
        enhancedTriage.predictedEscalation = 'YES';
      }

      enhancedTriage.severity = aiSeverity;
      enhancedTriage.priorityScore = aiPriorityScore;
    }

    const finalImageUrl = savedImageUrls.length > 0 ? JSON.stringify(savedImageUrls) : null;
    const mlAnalysisPayload = aiAnalysis
      ? { type: category === 'garbage' ? 'garbage' : category === 'road_damage' ? 'road_damage' : 'flood', ...aiAnalysis }
      : floodRisk
        ? { type: 'flood', ...floodRisk }
        : null;

    const savedReport = await Report.create({
      tracking_id: tracking_id || `CP-${Date.now()}`,
      name: name || 'Citizen',
      phone: phone || '',
      raw_text: finalRawText,
      specific_details: specific_details || finalRawText,
      image_url: finalImageUrl,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      district,
      city,
      area,
      category,
      severity: enhancedTriage.severity,
      severity_raw: enhancedTriage.severity,
      priority_score: enhancedTriage.priorityScore,
      predicted_escalation: enhancedTriage.predictedEscalation,
      escalation_confidence: enhancedTriage.escalationConfidence,
      severity_score: enhancedTriage.priorityScore,
      status: status || 'Registered',
      ml_analysis: mlAnalysisPayload,
      risk_signals: floodRisk ? { floodRisk } : null
    });

    const responsePayload = {
      success: true,
      triage: enhancedTriage,
      floodRisk,
      aiAnalysis,
      message: 'AI triage completed successfully',
      id: savedReport.id,
      tracking_id: savedReport.tracking_id,
      severity: enhancedTriage.severity,
      priority_score: enhancedTriage.priorityScore,
      predicted_escalation: enhancedTriage.predictedEscalation,
      escalation_confidence: enhancedTriage.escalationConfidence,
      severity_score: enhancedTriage.priorityScore,
      status: savedReport.status,
      image_url: finalImageUrl
    };

    res.json(responsePayload);

  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      error: 'Prediction failed', 
      detail: error.message 
    });
  }
});

export default router;