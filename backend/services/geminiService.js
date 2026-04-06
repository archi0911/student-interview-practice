require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL_SEQUENCE = [
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];

/**
 * Helper to calculate keyword matching score (0-100).
 * Case-insensitive substring matching for each key point.
 */
function calculateKeywordScore(userAnswer, keyPoints) {
  if (!keyPoints || !Array.isArray(keyPoints) || keyPoints.length === 0) return 100;
  if (!userAnswer || userAnswer.trim().length === 0) return 0;

  const answerLower = userAnswer.toLowerCase();
  let matchedCount = 0;

  keyPoints.forEach(point => {
    // Simple substring match for now. Can be enhanced with fuzzy matching later.
    if (answerLower.includes(point.toLowerCase())) {
      matchedCount++;
    }
  });

  return Math.round((matchedCount / keyPoints.length) * 100);
}

/**
 * Helper function to call Gemini with a fallback sequence.
 * @param {string} prompt - The prompt to send to Gemini.
 * @param {Object} generationConfig - Optional generation configuration.
 * @returns {Promise<string>} The generated text.
 */
async function callGeminiWithFallback(prompt, generationConfig = {}) {
  let lastError = null;

  for (const modelName of MODEL_SEQUENCE) {
    try {
      console.log(`Attempting with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          ...generationConfig,
          responseMimeType: "application/json",
        }
      });

      console.log(`Successfully used model: ${modelName}`);
      return result.response.text().trim();
    } catch (error) {
      console.error(`Error with model ${modelName}:`, error.message);
      lastError = error;
      // Continue to the next model in the sequence
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}

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

Generate ONE interview question that is strictly technical, realistic, and highly specific to the context mentioned above. 
Focus on:
1. Practical application of the technology
2. Internal workings or "Why" behind the technology
3. Common technical challenges or architectural decisions

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "question": "The interview question text",
  "ideal_answer": "A comprehensive ideal answer that a strong candidate would give",
  "key_points": ["key point 1", "key point 2", "key point 3"],
  "difficulty": "Easy | Medium | Hard",
  "category": "${category}"
}
`.trim();

  const text = await callGeminiWithFallback(prompt);

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

  const text = await callGeminiWithFallback(prompt);
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const aiResult = JSON.parse(cleaned);

  // ── Hybrid Scoring Logic (40% Keywords, 60% AI) ───────────────────────────
  const keywordScore = calculateKeywordScore(userAnswer, keyPoints);
  const finalScore = Math.round((keywordScore * 0.4) + (aiResult.score * 0.6));

  return {
    ...aiResult,
    score: finalScore,
    keyword_score: keywordScore, // providing breakdown for debugging/UI
    ai_score: aiResult.score
  };
}

/**
 * Evaluates a batch of student answers simultaneously.
 *
 * @param {Array} answers - Array of objects: { question, userAnswer, keyPoints }
 * @returns {Array} Array of evaluation results
 */
async function evaluateBatch(answers) {
  const answersText = answers.map((ans, idx) =>
    `--- Question ${idx + 1} ---\nQuestion: ${ans.question}\nCandidate's Answer: ${ans.userAnswer}`
  ).join('\n');

  const prompt = `You are an expert interview coach evaluating a candidate's answers to multiple interview questions.

Answers to Evaluate:
${answersText}

Evaluate each of the candidate's answers thoroughly based on concept understanding, technical correctness, and clarity.
NOTE: If a user answer is "(Skipped)" or extremely brief/empty, give it a score of 0 and state that it was skipped or incomplete.

CRITICAL INSTRUCTION: After evaluating all individual answers, you MUST synthesize the candidate's overall performance. Extract 2-3 specific technical concepts or topics they mastered for "overall_strengths", and 2-3 specific concepts they struggled with or skipped for "overall_weaknesses". Do NOT leave these arrays empty. Think holistically about the entire set of answers.
Finally, calculate an "overall_score" (0-100) and an "overall_correctness_pct" (0-100) reflecting their total performance across all questions.

Respond ONLY with a valid JSON object matching this exact format (no markdown, no extra text):
{
  "evaluations": [
    {
      "score": <integer 0-100>,
      "correctness_pct": <integer 0-100>,
      "covered_points": ["point 1", "point 2"],
      "missing_points": ["missing point 1", "missing point 2"],
      "strengths": "What the candidate did well",
      "weaknesses": "What the candidate missed or got wrong",
      "feedback": "Constructive, specific advice to improve the answer"
    }
  ],
  "overall_strengths": ["e.g. React Hooks", "e.g. Asynchronous JavaScript"],
  "overall_weaknesses": ["e.g. CSS Grid", "e.g. Error Handling"],
  "overall_score": <integer 0-100>,
  "overall_correctness_pct": <integer 0-100>
}`.trim();

  const text = await callGeminiWithFallback(prompt);

  const text_cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const batchResult = JSON.parse(text_cleaned);

  // ── Hybrid Scoring Logic for Batch ───────────────────────────────────────
  batchResult.evaluations = batchResult.evaluations.map((evalItem, idx) => {
    const originalAns = answers[idx];
    if (!originalAns || originalAns.userAnswer === '(Skipped)') return evalItem;

    const keywordScore = calculateKeywordScore(originalAns.userAnswer, originalAns.keyPoints);
    const finalScore = Math.round((keywordScore * 0.4) + (evalItem.score * 0.6));

    return {
      ...evalItem,
      score: finalScore,
      keyword_score: keywordScore,
      ai_score: evalItem.score
    };
  });

  return batchResult;
}

module.exports = { generateQuestion, evaluateAnswer, evaluateBatch };
