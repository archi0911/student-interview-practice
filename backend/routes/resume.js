const express = require('express');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { extractDocumentWords } = require('../utils/documentWordExtractor');

const router = express.Router();

// Store file in memory (buffer), limit to 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed'));
    }
  },
});

/**
 * POST /api/resume/upload
 * Accepts a PDF or DOCX resume, extracts text, then uses the local
 * dictionary-based extractor to find technical skills (no AI/API needed).
 *
 * Auth: Required (Bearer token)
 * Body: multipart/form-data  — field name: "resume"
 * Response: { success, data: { skills } }
 */
router.post('/upload', authenticate, upload.single('resume'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    // Step 1 & 2 combined: Extract text + match technical skills locally (no Gemini)
    const result = await extractDocumentWords(req.file.buffer, req.file.mimetype);

    if (!result.rawText || result.rawText.trim().length < 50) {
      return res.status(422).json({ error: 'Could not extract readable text from the file.' });
    }

    res.json({
      success: true,
      data: {
        skills: result.extractedSkills,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
