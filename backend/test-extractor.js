const fs = require('fs');
const path = require('path');
const { extractDocumentWords } = require('./utils/documentWordExtractor');

async function testExtractor() {
  // Get file path from command line arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node test-extractor.js <path-to-pdf-or-docx-file>');
    console.error('Example: node test-extractor.js ./dummy-resume.pdf');
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  // Determine mimetype from extension
  const ext = path.extname(filePath).toLowerCase();
  let mimetype = '';
  
  if (ext === '.pdf') {
    mimetype = 'application/pdf';
  } else if (ext === '.docx') {
    mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  } else if (ext === '.doc') {
    mimetype = 'application/msword';
  } else {
    console.error('Unsupported file extension. Please provide a .pdf, .docx, or .doc file.');
    process.exit(1);
  }

  console.log(`Reading file: ${filePath}`);
  console.log(`Detected type: ${mimetype}`);
  console.log('Extracting words... (This does NOT use Gemini)');
  
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await extractDocumentWords(buffer, mimetype);
    
    console.log('\n=== EXTRACTION RESULTS ===');
    console.log(`Total text length: ${result.rawText.length} characters`);
    console.log(`Total exact words found: ${result.words.length} words`);
    
    console.log('\n--- First 30 Words ---');
    console.log(result.words.slice(0, 30));
    
    console.log('\n--- Last 10 Words ---');
    console.log(result.words.slice(-10));
    console.log('==========================\n');
    
    console.log('Success! The standalone extractor works perfectly.');
  } catch (error) {
    console.error('Error during extraction:', error.message);
  }
}

testExtractor();
