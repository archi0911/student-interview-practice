const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { normalizeCategory } = require('../utils/categoryNormalizer');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
You are an expert technical recruiter. Analyze the following resume text. 
CRITICAL PRIORITY: Extract strict technical skills & programming languages first.

1. Programming Languages (e.g., Python, C++, Java, JavaScript, etc.)
2. Frameworks & Libraries (e.g., React, Node.js, Spring, Django)
3. Tools & Technologies (e.g., Docker, Git, MySQL, AWS, Jenkins)
4. Specific Technical Concepts (e.g., OOP, Data Structures, Machine Learning, Rest APIs)

CRITICAL: EXCLUDE all soft skills, personality traits, and generic "hard skills" that aren't specific technical tools.

Resume Text:
"""
${rawText.slice(0, 10000)}
"""

Respond ONLY with a valid JSON object (no markdown, no extra text):
{
  "name": "Full name of the candidate if found, else null",
  "skills": ["put all technical skills and programming languages here as an array of strings"],
  "technologies": ["tech1", "tech2"],
  "education": "Brief education summary",
  "experience": "Brief work experience summary (years, roles)",
  "projects": ["Project 1 description", "Project 2 description"],
  "summary": "A 2-3 sentence profile summary useful for generating interview questions"
}
`.trim();

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
    }
  });
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleaned);

  if (typeof parsed.skills === 'string') {
    // If Gemini accidentally returns a single comma-separated or space-separated string
    parsed.skills = parsed.skills.split(/[\s,]+/).filter(Boolean);
  }
  
  if (parsed.skills && Array.isArray(parsed.skills)) {
    // Flatten in case of nested arrays and normalize
    parsed.skills = parsed.skills.flat().filter(Boolean);
  }

  // Analyze for OOPs concepts
  const hasOOPsLanguage = parsed.skills?.some(s => {
    const lower = s.toLowerCase();
    return lower.includes('java') || lower.includes('c++') || lower.includes('c#') || lower === 'python';
  });

  if (hasOOPsLanguage && parsed.skills) {
    if (!parsed.skills.some(s => s.toLowerCase().includes('oop') || s.toLowerCase().includes('object oriented'))) {
      parsed.skills.push('OOPs');
    }
  }

  if (parsed.skills && Array.isArray(parsed.skills)) {
    parsed.skills = parsed.skills.map(s => normalizeCategory(s));
  }

  return parsed;
}

module.exports = { extractText, extractSkillsFromResume };
