import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { Report } from '../models/index.js';
import { 
  getFloodRiskFromComplaint, 
  predictGarbage, 
  predictRoadDamage,
  predictPriority 
} from '../services/floodRiskClient.js';
import { triage } from '../services/triage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname || 'upload'));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Main prediction endpoint that processes complaints
router.post('/predict', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'photo', maxCount: 1 }
]), async (req, res) => {
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

    const uploadedFile = req.files?.image?.[0] || req.files?.photo?.[0] || null;
    const finalRawText = raw_text || description || specific_details || '';

    // Basic triage
    const triageResult = triage({
      category,
      rawText: finalRawText,
      specificDetails: specific_details || ''
    });

    let aiAnalysis = null;
    let floodRisk = null;

    // Get flood risk for flood-related complaints
    if (category === 'flood' && district) {
      try {
        floodRisk = await getFloodRiskFromComplaint({
          district,
          place_name: area || city,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null
        });
      } catch (error) {
        console.warn('Flood risk prediction failed:', error.message);
      }
    }

    // Run AI image analysis if image is provided
    if (uploadedFile && (category === 'garbage' || category === 'road_damage')) {
      try {
        if (category === 'garbage') {
          aiAnalysis = await predictGarbage(
            uploadedFile.buffer,
            uploadedFile.originalname,
            uploadedFile.mimetype
          );
        } else if (category === 'road_damage') {
          aiAnalysis = await predictRoadDamage(
            uploadedFile.buffer,
            uploadedFile.originalname,
            uploadedFile.mimetype,
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
    
    if (aiAnalysis && !aiAnalysis.error) {
      if (aiAnalysis.confidence > 0.8) {
        enhancedTriage.priorityScore = Math.min(0.95, enhancedTriage.priorityScore + 0.15);
        enhancedTriage.severity = enhancedTriage.severity === 'LOW' ? 'MEDIUM' : enhancedTriage.severity;
      }
    }

    if (floodRisk && floodRisk.risk_level === 'HIGH') {
      enhancedTriage.severity = 'CRITICAL';
      enhancedTriage.priorityScore = 0.95;
      enhancedTriage.predictedEscalation = 'YES';
    }

    const finalImageUrl = uploadedFile ? `/uploads/${uploadedFile.filename}` : null;
    const savedReport = await Report.create({
      tracking_id: tracking_id || `CP-${Date.now()}`,
      name: name || 'Citizen',
      phone: phone || '',
      raw_text: finalRawText,
      specific_details: specific_details || '',
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
      ml_analysis: aiAnalysis || (floodRisk ? { type: 'flood', ...floodRisk } : null),
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