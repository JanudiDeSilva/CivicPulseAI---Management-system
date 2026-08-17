import express from 'express';
import multer from 'multer';
import { 
  getFloodRiskFromComplaint, 
  predictGarbage, 
  predictRoadDamage,
  predictPriority 
} from '../services/floodRiskClient.js';
import { triage } from '../services/triage.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Main prediction endpoint that processes complaints
router.post('/predict', upload.single('image'), async (req, res) => {
  try {
    const { 
      category, 
      district, 
      city, 
      area, 
      latitude, 
      longitude, 
      raw_text, 
      specific_details 
    } = req.body;

    // Basic triage
    const triageResult = triage({
      category,
      rawText: raw_text,
      specificDetails: specific_details
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
    if (req.file && (category === 'garbage' || category === 'road_damage')) {
      try {
        if (category === 'garbage') {
          aiAnalysis = await predictGarbage(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype
          );
        } else if (category === 'road_damage') {
          aiAnalysis = await predictRoadDamage(
            req.file.buffer,
            req.file.originalname,
            req.file.mimetype,
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

    res.json({
      success: true,
      triage: enhancedTriage,
      floodRisk,
      aiAnalysis,
      message: 'AI triage completed successfully'
    });

  } catch (error) {
    console.error('Prediction error:', error);
    res.status(500).json({ 
      error: 'Prediction failed', 
      detail: error.message 
    });
  }
});

export default router;