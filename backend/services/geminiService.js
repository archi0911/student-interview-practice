require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Generates a single interview question with metadata.
 *
 * @param {string} mode     - 'resume' | 'role' | 'topic'
 * @param {string} context  - extracted skills text / role name / topic name
 * @param {string} category - 'Technical' | 'HR' | 'Behavioral' | 'Aptitude' | 'Random'
 * @returns {Object}  { question, ideal_answer, key_points: [], difficulty }
 */
async function generateQuestion(mode, context, category = 'Random') {
  const categoryInstruction =
    category === 'Random'
      ? 'Choose the most appropriate category (Technical, HR, Behavioral, or Aptitude) based on the context.'
      : `Generate a ${category} question.`;

  const modeContext = {
    resume: `The candidate has the following skills and experience extracted from their resume:\n${context}`,
    role: `The candidate is interviewing for the role of: ${context}`,
    topic: `The candidate wants to practice questions on the topic: ${context}`,
  }[mode] || `Context: ${context}`;

  const prompt = `
You are an expert technical interviewer. ${modeContext}

${categoryInstruction}

Generate ONE interview question that is specific, realistic, and helpful for the candidate's practice.

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "question": "The interview question text",
  "ideal_answer": "A comprehensive ideal answer that a strong candidate would give",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "difficulty": "Easy | Medium | Hard",
  "category": "Technical | HR | Behavioral | Aptitude"
}
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip any accidental markdown code fences
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Evaluates a student's answer against the ideal answer.
 *
 * @param {string} question      - The interview question
 * @param {string} idealAnswer   - The AI-generated ideal answer
 * @param {Array}  keyPoints     - Key evaluation points
 * @param {string} userAnswer    - The student's spoken/typed answer
 * @returns {Object}  Detailed evaluation result
 */
async function evaluateAnswer(question, idealAnswer, keyPoints, userAnswer) {
  const prompt = `
You are an expert interview coach evaluating a candidate's answer.

Question: ${question}

Ideal Answer: ${idealAnswer}

Key Points to cover: ${JSON.stringify(keyPoints)}

Candidate's Answer: ${userAnswer}

Evaluate the candidate's answer thoroughly. Consider:
- Concept understanding
- Technical correctness
- Coverage of key points
- Clarity of explanation

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "score": <integer 0-100>,
  "correctness_pct": <integer 0-100>,
  "covered_points": ["point 1", "point 2"],
  "missing_points": ["missing point 1", "missing point 2"],
  "strengths": "What the candidate did well",
  "weaknesses": "What the candidate missed or got wrong",
  "feedback": "Constructive, specific advice to improve the answer"
}
`.trim();

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { generateQuestion, evaluateAnswer };
