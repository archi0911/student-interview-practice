const express = require('express');
const multer = require('multer');
const { extractDocumentWords } = require('./utils/documentWordExtractor');

const app = express();
const port = 3005; 

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.mimetype === 'application/msword'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are allowed!'), false);
    }
  }
});

app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/test-upload.html');
});

app.post('/api/extract-words', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    console.log(`Processing file: ${req.file.originalname}`);
    
    // Call our updated exact-match extractor
    const result = await extractDocumentWords(req.file.buffer, req.file.mimetype);

    res.json({
      success: true,
      filename: req.file.originalname,
      totalLength: result.rawText.length,
      extractedSkillsCount: result.extractedSkills.length,
      extractedSkills: result.extractedSkills, // We are now sending the matched skills!
      allWordsCount: result.words.length // Just for reference
    });
  } catch (error) {
    console.error('Error extracting words:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.listen(port, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Standalone Tech Skill Extractor Server Running!`);
  console.log(`======================================================\n`);
  console.log(`👉 To test the UI, click here: http://localhost:${port}\n`);
});
