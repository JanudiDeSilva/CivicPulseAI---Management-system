const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const uploadDir = 'uploads';

// Existing routes...

// Delete complaint and image
router.delete('/reports/:id', async (req, res) => {
    const complaintId = req.params.id;
    try {
        const complaint = await Report.findByIdAndDelete(complaintId);
        if (!complaint) {
            return res.status(404).send('Complaint not found');
        }

        const imageFilename = complaint.image;
        if (imageFilename) {
            const filepath = path.join(uploadDir, imageFilename);
            if (fs.existsSync(filepath)) {
                fs.unlinkSync(filepath);
            }
        }

        res.send('Complaint deleted');
    } catch (error) {
        res.status(500).send('Server error');
    }
});
======= 

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

module.exports = router;