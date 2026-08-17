import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Report } from '../models/index.js';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Get all reports
router.get('/reports', async (_req, res) => {
    try {
        const reports = await Report.findAll({
            order: [['created_at', 'DESC']]
        });
        res.json({ reports });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch reports', details: error.message });
    }
});

// Get single report by ID
router.get('/reports/:id', async (req, res) => {
    try {
        const report = await Report.findByPk(req.params.id);
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json(report);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch report', details: error.message });
    }
});

// Create new report with image upload
router.post('/reports', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), async (req, res) => {
    try {
        const { 
            name, 
            phone, 
            raw_text, 
            specific_details, 
            latitude, 
            longitude, 
            district, 
            city, 
            area, 
            category, 
            severity_raw 
        } = req.body;

        const uploadedFile = req.files?.image?.[0] || req.files?.photo?.[0] || null;
        const imageUrl = uploadedFile ? `/uploads/${uploadedFile.filename}` : null;

        const report = await Report.create({
            name,
            phone,
            raw_text,
            specific_details,
            image_url: imageUrl,
            latitude: latitude ? parseFloat(latitude) : null,
            longitude: longitude ? parseFloat(longitude) : null,
            district,
            city,
            area,
            category,
            severity_raw,
            status: 'Registered'
        });

        res.status(201).json(report);
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({ error: 'Failed to create report', details: error.message });
    }
});

// Existing routes...

// Delete complaint and image
router.delete('/reports/:id', async (req, res) => {
    const complaintId = req.params.id;
    try {
        const complaint = await Report.findByPk(complaintId);
        if (!complaint) {
            return res.status(404).json({ error: 'Complaint not found' });
        }

        const imageFilename = complaint.image_url;
        if (imageFilename) {
            const filepath = path.join(uploadDir, imageFilename);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }

        await complaint.destroy();
        res.json({ message: 'Complaint deleted successfully' });
    } catch (error) {
        console.error('Error deleting complaint:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Serve images
router.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);

    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
});

export default router;