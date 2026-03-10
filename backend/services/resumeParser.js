const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Extracts plain text from a PDF or DOCX buffer.
 * @param {Buffer} buffer  - File buffer
 * @param {string} mimetype - File MIME type
 * @returns {string}  Raw extracted text
 */
async function extractText(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error('Unsupported file type. Please upload a PDF or DOCX file.');
}

/**
 * Uses Gemini to extract structured skills & context from resume text.
 * @param {string} rawText - Plain text from the resume
 * @returns {Object} { skills: [], experience: string, summary: string }
 */
async function extractSkillsFromResume(rawText) {
  const prompt = `
You are an expert HR assistant. Analyze the following resume text and extract structured information.

Resume Text:
"""
${rawText.slice(0, 8000)}
"""

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "name": "Full name of the candidate if found, else null",
  "skills": ["skill1", "skill2", "skill3"],
  "technologies": ["tech1", "tech2"],
  "education": "Brief education summary",
  "experience": "Brief work experience summary (years, roles)",
  "projects": ["Project 1 description", "Project 2 description"],
  "summary": "A 2-3 sentence profile summary useful for generating interview questions"
}
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { extractText, extractSkillsFromResume };
