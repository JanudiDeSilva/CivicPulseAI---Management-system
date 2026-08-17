import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Report } from '../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const uploadDir = path.join(__dirname, '../../uploads');

// Existing routes...

// Delete complaint and image
router.delete('/reports/:id', async (req, res) => {
    const complaintId = req.params.id;
    try {
        const complaint = await Report.findByPk(complaintId);
        if (!complaint) {
            return res.status(404).send('Complaint not found');
        }

        const imageFilename = complaint.image_url;
        if (imageFilename) {
            const filepath = path.join(uploadDir, imageFilename);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }

        await complaint.destroy();
        res.send('Complaint deleted');
    } catch (error) {
        res.status(500).send('Server error');
    }
});

// Serve images
router.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(uploadDir, filename);

    if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
    } else {
        res.status(404).send('Image not found');
    }
});

export default router;