import express from 'express';
import multer from 'multer';

import { Report, ReportImage } from '../models/index.js';

import {
  getFloodRiskFromComplaint,
  predictGarbage,
  predictRoadDamage
} from '../services/floodRiskClient.js';

import { triage } from '../services/triage.js';
import { uploadBufferToSupabase } from '../services/supabaseStorage.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

router.post(
  '/predict',
  upload.array('photos', 10),
  async (req, res) => {
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

      const firstFile =
        uploadedFiles.length > 0
          ? uploadedFiles[0]
          : null;

      const finalRawText =
        raw_text ||
        description ||
        specific_details ||
        '';

      const finalTrackingId =
        tracking_id ||
        `CP-${Date.now()}`;

      // ------------------------------------------------------------
      // Upload every image to Supabase Storage
      // ------------------------------------------------------------

      const uploadedImages = [];

      for (
        let i = 0;
        i < uploadedFiles.length;
        i++
      ) {
        const file = uploadedFiles[i];

        const ext =
          file.originalname &&
          file.originalname.includes('.')
            ? file.originalname.substring(
                file.originalname.lastIndexOf('.')
              )
            : '.jpg';

        const destPath =
          `reports/${finalTrackingId}/${Date.now()}-${i}${ext}`;

        const publicUrl =
          await uploadBufferToSupabase(
            file.buffer,
            destPath,
            file.mimetype || 'image/jpeg'
          );

        if (publicUrl) {
          uploadedImages.push({
            url: publicUrl,
            isFirst: i === 0
          });
        } else {
          console.warn(
            `Image ${i} failed to upload to Supabase Storage, skipping.`
          );
        }
      }

      // ------------------------------------------------------------
      // Basic triage
      // ------------------------------------------------------------

      const triageResult = triage({
        category,
        rawText: finalRawText,
        specificDetails:
          specific_details || ''
      });

      let aiAnalysis = null;
      let floodRisk = null;

      // ------------------------------------------------------------
      // Flood risk prediction
      // ------------------------------------------------------------

      if (category === 'flood') {
        try {
          let parsedImpact = [];

          if (req.body.impact) {
            if (
              Array.isArray(
                req.body.impact
              )
            ) {
              parsedImpact =
                req.body.impact;
            } else {
              try {
                parsedImpact =
                  JSON.parse(
                    req.body.impact
                  );
              } catch (_) {
                parsedImpact = [
                  req.body.impact
                ];
              }
            }
          }

          floodRisk =
            await getFloodRiskFromComplaint({
              district,

              place_name:
                area || city,

              latitude:
                latitude
                  ? parseFloat(latitude)
                  : null,

              longitude:
                longitude
                  ? parseFloat(longitude)
                  : null,

              problem_type:
                req.body.problemType ||
                req.body.problem_type ||
                '',

              severity_waterlogging:
                req.body.severityWaterlogging ||
                req.body.severity_waterlogging ||
                '',

              water_status:
                req.body.waterStatus ||
                req.body.water_status ||
                '',

              duration:
                req.body.problemDuration ||
                req.body.duration ||
                '',

              impact: parsedImpact,

              description:
                finalRawText
            });
        } catch (error) {
          console.warn(
            'Flood risk prediction failed:',
            error.message
          );
        }
      }

      // ------------------------------------------------------------
      // AI image analysis
      // Only first image is sent to AI
      // ------------------------------------------------------------

      if (
        firstFile &&
        (
          category === 'garbage' ||
          category === 'road_damage'
        )
      ) {
        try {
          // Garbage AI
          if (
            category === 'garbage'
          ) {
            aiAnalysis =
              await predictGarbage(
                firstFile.buffer,
                firstFile.originalname,
                firstFile.mimetype
              );
          }

          // Road damage AI
          else if (
            category === 'road_damage'
          ) {
            aiAnalysis =
              await predictRoadDamage(
                firstFile.buffer,
                firstFile.originalname,
                firstFile.mimetype,
                category
              );
          }
        } catch (error) {
          console.warn(
            'AI image analysis failed:',
            error.message
          );

          aiAnalysis = {
            error: 'AI analysis failed',
            detail: error.message
          };
        }
      }

      // ------------------------------------------------------------
      // Enhance triage
      // ------------------------------------------------------------

      let enhancedTriage = {
        ...triageResult
      };

      let aiSeverity =
        enhancedTriage.severity;

      let aiPriorityScore =
        enhancedTriage.priorityScore;

      // ------------------------------------------------------------
      // Convert AI result into severity
      // ------------------------------------------------------------

      const deriveModelSeverity = (
        analysis,
        fallback = 'LOW'
      ) => {
        if (
          !analysis ||
          analysis.error
        ) {
          return fallback;
        }

        // Risk level
        if (
          analysis.risk_level
        ) {
          return String(
            analysis.risk_level
          ).toUpperCase();
        }

        // Flood probability
        if (
          analysis.flood_probability != null
        ) {
          const score =
            Number(
              analysis.flood_probability
            );

          if (score >= 0.7) {
            return 'HIGH';
          }

          if (score >= 0.35) {
            return 'MEDIUM';
          }

          return 'LOW';
        }

        const confidence =
          Number(
            analysis.confidence ?? 0
          );

        // Image damage score
        if (
          analysis.image_damage_score != null
        ) {
          const score =
            Number(
              analysis.image_damage_score || 0
            );

          if (
            score >= 3 ||
            confidence >= 0.7
          ) {
            return 'HIGH';
          }

          if (
            score >= 1.5 ||
            confidence >= 0.45
          ) {
            return 'MEDIUM';
          }

          return 'LOW';
        }

        // Confidence-based severity
        if (confidence >= 0.8) {
          return 'HIGH';
        }

        if (confidence >= 0.5) {
          return 'MEDIUM';
        }

        return 'LOW';
      };

      // ------------------------------------------------------------
      // Convert AI result into priority
      // ------------------------------------------------------------

      const deriveModelPriority = (
        analysis,
        fallback = 0.3
      ) => {
        if (
          !analysis ||
          analysis.error
        ) {
          return fallback;
        }

        // Flood probability
        if (
          analysis.flood_probability != null
        ) {
          return Number(
            Math.min(
              Math.max(
                Number(
                  analysis.flood_probability
                ),
                0
              ),
              1
            ).toFixed(2)
          );
        }

        // Confidence
        if (
          analysis.confidence != null
        ) {
          return Number(
            Math.min(
              Math.max(
                Number(
                  analysis.confidence
                ),
                0
              ),
              1
            ).toFixed(2)
          );
        }

        // Image damage score
        if (
          analysis.image_damage_score != null
        ) {
          const score =
            Number(
              analysis.image_damage_score || 0
            );

          return Number(
            Math.min(
              Math.max(
                score / 10,
                0.15
              ),
              0.95
            ).toFixed(2)
          );
        }

        return fallback;
      };

      // ------------------------------------------------------------
      // Flood-specific AI result
      // ------------------------------------------------------------

      if (
        category === 'flood' &&
        floodRisk
      ) {
        aiSeverity =
          floodRisk.severity ||
          'LOW';

        aiPriorityScore =
          Number(
            (
              (floodRisk.priority_score || 50) /
              100
            ).toFixed(2)
          );

        enhancedTriage.predictedEscalation =
          (
            floodRisk.escalation_flag === 'Yes' ||
            floodRisk.escalation_flag === 'YES'
          )
            ? 'YES'
            : 'NO';

        enhancedTriage.severity =
          aiSeverity;

        enhancedTriage.priorityScore =
          aiPriorityScore;
      } else {
        // ----------------------------------------------------------
        // Use flood risk information if available
        // ----------------------------------------------------------

        if (
          floodRisk &&
          floodRisk.risk_level
        ) {
          aiSeverity =
            String(
              floodRisk.risk_level
            ).toUpperCase();

          aiPriorityScore =
            Math.max(
              aiPriorityScore,
              Number(
                (
                  floodRisk.flood_probability ??
                  0.7
                ).toFixed(2)
              )
            );
        }

        // ----------------------------------------------------------
        // Use image AI analysis
        // ----------------------------------------------------------

        if (
          aiAnalysis &&
          !aiAnalysis.error
        ) {
          const modelSeverity =
            deriveModelSeverity(
              aiAnalysis,
              aiSeverity
            );

          const modelPriority =
            deriveModelPriority(
              aiAnalysis,
              aiPriorityScore
            );

          aiSeverity =
            modelSeverity;

          aiPriorityScore =
            modelPriority;
        }

        // ----------------------------------------------------------
        // Critical flood override
        // ----------------------------------------------------------

        if (
          floodRisk &&
          floodRisk.risk_level === 'HIGH'
        ) {
          aiSeverity =
            'CRITICAL';

          aiPriorityScore =
            0.95;

          enhancedTriage.predictedEscalation =
            'YES';
        }

        enhancedTriage.severity =
          aiSeverity;

        enhancedTriage.priorityScore =
          aiPriorityScore;
      }

      // ------------------------------------------------------------
      // Cover image
      // ------------------------------------------------------------

      const coverImageUrl =
        uploadedImages.length > 0
          ? uploadedImages[0].url
          : null;

      // ------------------------------------------------------------
      // ML analysis payload
      // ------------------------------------------------------------

      const mlAnalysisPayload =
        aiAnalysis
          ? {
              type:
                category === 'garbage'
                  ? 'garbage'
                  : category === 'road_damage'
                    ? 'road_damage'
                    : 'flood',

              ...aiAnalysis
            }
          : floodRisk
            ? {
                type: 'flood',
                ...floodRisk
              }
            : null;

      // ------------------------------------------------------------
      // Save report
      // ------------------------------------------------------------

      const savedReport =
        await Report.create({
          tracking_id:
            finalTrackingId,

          name:
            name || 'Citizen',

          phone:
            phone || '',

          raw_text:
            finalRawText,

          specific_details:
            specific_details ||
            finalRawText,

          image_url:
            coverImageUrl,

          latitude:
            latitude
              ? parseFloat(latitude)
              : null,

          longitude:
            longitude
              ? parseFloat(longitude)
              : null,

          district,
          city,
          area,
          category,

          severity:
            enhancedTriage.severity,

          severity_raw:
            enhancedTriage.severity,

          priority_score:
            enhancedTriage.priorityScore,

          predicted_escalation:
            enhancedTriage.predictedEscalation,

          escalation_confidence:
            enhancedTriage.escalationConfidence,

          severity_score:
            enhancedTriage.priorityScore,

          status:
            status || 'Registered',

          ml_analysis:
            mlAnalysisPayload,

          risk_signals:
            floodRisk
              ? { floodRisk }
              : null
        });

      // ------------------------------------------------------------
      // Save uploaded images
      // ------------------------------------------------------------

      if (
        uploadedImages.length > 0
      ) {
        await ReportImage.bulkCreate(
          uploadedImages.map(
            (img, index) => ({
              report_id:
                savedReport.id,

              image_url:
                img.url,

              ml_analysis:
                img.isFirst
                  ? mlAnalysisPayload
                  : null,

              sort_order:
                index
            })
          )
        );
      }

      // ------------------------------------------------------------
      // Response
      // ------------------------------------------------------------

      res.json({
        success: true,

        triage:
          enhancedTriage,

        floodRisk,

        aiAnalysis,

        message:
          'AI triage completed successfully',

        id:
          savedReport.id,

        tracking_id:
          savedReport.tracking_id,

        severity:
          enhancedTriage.severity,

        priority_score:
          enhancedTriage.priorityScore,

        predicted_escalation:
          enhancedTriage.predictedEscalation,

        escalation_confidence:
          enhancedTriage.escalationConfidence,

        severity_score:
          enhancedTriage.priorityScore,

        status:
          savedReport.status,

        image_url:
          coverImageUrl,

        images:
          uploadedImages.map(
            (img) => img.url
          )
      });

    } catch (error) {
      console.error(
        'Prediction error:',
        error
      );

      res.status(500).json({
        error:
          'Prediction failed',

        detail:
          error.message
      });
    }
  }
);

// VERY IMPORTANT:
// server.js imports this router as a default import.
export default router;