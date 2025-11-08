const express = require('express');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('./auth');

const router = express.Router();

// Middleware to authenticate via query param or header (for iframe loading)
function authenticateTokenFlexible(req, res, next) {
  // Try Authorization header first
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // If no header token, try query parameter
  if (!token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  });
}

// Serve calendar file (PDF or Excel)
router.get('/view', authenticateTokenFlexible, (req, res) => {
  try {
    // Try PDF first, then fall back to Excel
    const pdfPath = path.join(__dirname, '../../Calendrier CDBHS 2025-2026 V5.pdf');
    const excelPath = path.join(__dirname, '../../Calendrier CDBHS 2025-2026 V5.xlsx');

    let filePath, contentType, fileName;

    if (fs.existsSync(pdfPath)) {
      filePath = pdfPath;
      contentType = 'application/pdf';
      fileName = 'Calendrier_CDBHS_2025-2026.pdf';
    } else if (fs.existsSync(excelPath)) {
      filePath = excelPath;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = 'Calendrier_CDBHS_2025-2026.xlsx';
    } else {
      return res.status(404).json({ error: 'Calendar file not found' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download calendar file
router.get('/download', authenticateToken, (req, res) => {
  try {
    const pdfPath = path.join(__dirname, '../../Calendrier CDBHS 2025-2026 V5.pdf');
    const excelPath = path.join(__dirname, '../../Calendrier CDBHS 2025-2026 V5.xlsx');

    let filePath, contentType, fileName;

    if (fs.existsSync(pdfPath)) {
      filePath = pdfPath;
      contentType = 'application/pdf';
      fileName = 'Calendrier_CDBHS_2025-2026.pdf';
    } else if (fs.existsSync(excelPath)) {
      filePath = excelPath;
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = 'Calendrier_CDBHS_2025-2026.xlsx';
    } else {
      return res.status(404).json({ error: 'Calendar file not found' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    console.error('Error serving calendar:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
