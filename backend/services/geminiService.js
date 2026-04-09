require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const natural = require('natural');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const MODEL_SEQUENCE = [
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash-lite'
];

// Common English stop words to exclude from semantic stem comparison
const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','of','in','on','at','to',
  'for','with','by','from','as','into','through','it','its',
  'this','that','these','those','and','or','but','so','not','also',
  'used','use','uses','using','based','related'
]);

/**
 * Tokenizes a string into lowercase words (strips punctuation).
 */
function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/**
 * Stems and filters stop words from a phrase.
 * Returns array of meaningful Porter-stemmed tokens.
 */
function stemTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => !STOP_WORDS.has(t))
    .map(t => natural.PorterStemmer.stem(t));
}

/**
 * Checks if a key point phrase is covered in the user's answer.
 *
 * Pass 1 – Exact token match: all tokens of the key point appear literally in the answer.
 * Pass 2 – Semantic stem match: ≥50% of the key point's meaningful stems are found
 *           in the answer's stems, handling paraphrasing like
 *           "Memory is used" ↔ "Utilisation of memory".
 *
 * @param {string[]} answerTokens       Raw lowercase tokens of the full answer
 * @param {string[]} answerStemmedTokens Stemmed (stop-word-free) tokens of the answer
 * @param {string}   keyPoint           The key point phrase to check
 * @returns {boolean}
 */
function isPointCovered(answerTokens, answerStemmedTokens, keyPoint) {
  // Pass 1: exact literal token match
  const pointTokens = tokenize(keyPoint);
  if (pointTokens.every(token => answerTokens.includes(token))) {
    return true;
  }

  // Pass 2: stemmed semantic coverage
  const pointStems = stemTokens(keyPoint);
  if (pointStems.length === 0) return false; // nothing meaningful to match

  const matchedStems = pointStems.filter(s => answerStemmedTokens.includes(s));
  const coverage = matchedStems.length / pointStems.length;

  // Match if at least 50% of the key point's core stems appear in the answer
  return coverage >= 0.5;
}

/**
 * Calculates keyword matching score (0–100) and returns matched/missed lists.
 *
 * Uses a two-pass strategy per key point:
 *   1. Exact token match (fast path)
 *   2. Semantic stem coverage ≥ 50%  (handles paraphrasing / synonyms)
 *
 * Formula: S_keyword = round( (M / N) × 100 )   capped at 100
 *
 * Edge cases:
 *   - N = 0 (no key points defined)  → returns 100 (avoid division-by-zero)
 *   - Empty / skipped answer          → returns 0
 *
 * @param {string} userAnswer
 * @param {Array}  keyPoints
 * @returns {{ score: number, matched: string[], missed: string[] }}
 */
function calculateKeywordScore(userAnswer, keyPoints) {
  if (!keyPoints || !Array.isArray(keyPoints) || keyPoints.length === 0) {
    return { score: 100, matched: [], missed: [] };
  }
  if (!userAnswer || userAnswer.trim().length === 0) {
    return { score: 0, matched: [], missed: keyPoints };
  }

  const answerTokens       = tokenize(userAnswer);
  const answerStemmedTokens = stemTokens(userAnswer);
  const matched = [];
  const missed  = [];

  keyPoints.forEach(point => {
    if (isPointCovered(answerTokens, answerStemmedTokens, point)) {
      matched.push(point);
    } else {
      missed.push(point);
    }
  });

  // S_keyword = min(100, round( M / N × 100 ))
  const score = Math.min(100, Math.round((matched.length / keyPoints.length) * 100));
  return { score, matched, missed };
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
 * Merges keyword-matched points with AI-detected concepts into a single
 * deduplicated array. AI concepts are only added if they don't already
 * appear (case-insensitive) in the keyword list.
 *
 * @param {string[]} kwList   - Points from keyword pass (covered OR missed)
 * @param {string[]} aiList   - Concepts from AI pass (covered_concepts OR missing_concepts)
 * @returns {string[]}
 */
function mergePoints(kwList = [], aiList = []) {
  const normalised = new Set(kwList.map(p => p.toLowerCase().trim()));
  const extras = (aiList || []).filter(c => !normalised.has(c.toLowerCase().trim()));
  return [...kwList, ...extras];
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

Evaluate the candidate's answer for:
- Technical accuracy and concept understanding (most important)
- Clarity and depth of explanation
- Overall quality of the response

IMPORTANT: Return ONLY an "ai_score" (0-100) reflecting the semantic quality of the answer.
Do NOT factor in keyword matching — that is handled separately.
Also provide strengths, weaknesses, and feedback.

Additionally, extract:
- "covered_concepts": short labels (2-5 words each) for technical concepts the candidate DID explain well — beyond the predefined key points.
- "missing_concepts": short labels (2-5 words each) for important concepts the candidate FAILED to mention or explain — beyond the predefined key points.

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "ai_score": <integer 0-100>,
  "strengths": "What the candidate did well",
  "weaknesses": "What the candidate missed or got wrong",
  "feedback": "Constructive, specific advice to improve the answer",
  "covered_concepts": ["concept one", "concept two"],
  "missing_concepts": ["concept three", "concept four"]
}
`.trim();

  const text = await callGeminiWithFallback(prompt);
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const aiResult = JSON.parse(cleaned);

  // ── Structural Evaluation: Keyword-Based (40%) ────────────────────────────
  // score = (M / N) * 100  →  weighted at 40%
  const kwResult    = calculateKeywordScore(userAnswer, keyPoints);
  const kwScore     = kwResult.score;                     // 0–100
  const aiScore     = Math.min(100, Math.max(0, aiResult.ai_score ?? 0)); // 0–100

  // ── Semantic Evaluation: AI-Based (60%) ──────────────────────────────────
  // Final composite: (kwScore * 0.40) + (aiScore * 0.60)
  const finalScore       = Math.round((kwScore * 0.4) + (aiScore * 0.6));
  const correctnessPct   = Math.round((kwResult.matched.length / Math.max(keyPoints?.length || 1, 1)) * 100);

  // ── Merge keyword points with AI-detected concepts ──────────────────────
  // covered_points = keyword matches  +  AI-identified covered concepts
  // missing_points = keyword misses   +  AI-identified missing concepts
  const coveredPoints = mergePoints(kwResult.matched, aiResult.covered_concepts);
  const missingPoints = mergePoints(kwResult.missed,  aiResult.missing_concepts);

  return {
    score:           finalScore,
    correctness_pct: correctnessPct,
    keyword_score:   kwScore,
    ai_score:        aiScore,
    covered_points:  coveredPoints,
    missing_points:  missingPoints,
    strengths:       aiResult.strengths  || '',
    weaknesses:      aiResult.weaknesses || '',
    feedback:        aiResult.feedback   || '',
    detailed_breakdown: {
      dataset_layer_40_percent: {
        keyword_score: kwScore,
        keyword_math: `${kwResult.matched.length} / ${Math.max(keyPoints?.length || 1, 1)} = ${kwScore}%`,
        covered_key_points: kwResult.matched,
        missing_key_points: kwResult.missed
      },
      ai_layer_60_percent: {
        ai_score: aiScore,
        covered_concepts: aiResult.covered_concepts || [],
        missing_concepts: aiResult.missing_concepts || []
      },
      calculation: {
        formula: `(${kwScore} * 0.4) + (${aiScore} * 0.6)`,
        math: `${(kwScore * 0.4).toFixed(1)} + ${(aiScore * 0.6).toFixed(1)}`,
        final_score: finalScore
      }
    }
  };
}

/**
 * Evaluates a batch of student answers simultaneously.
 *
 * @param {Array} answers - Array of objects: { question, userAnswer, keyPoints }
 * @returns {Array} Array of evaluation results
 */
async function evaluateBatch(answers) {
  // Build prompt with key_points included per question so Gemini has full context
  const answersText = answers.map((ans, idx) => [
    `--- Question ${idx + 1} ---`,
    `Question: ${ans.question}`,
    `Key Points: ${JSON.stringify(ans.keyPoints || [])}`,
    `Candidate's Answer: ${ans.userAnswer}`,
  ].join('\n')).join('\n\n');

  const prompt = `You are an expert interview coach evaluating a candidate's answers to multiple interview questions.

Answers to Evaluate:
${answersText}

Evaluate each answer for technical accuracy, conceptual understanding, and clarity of explanation.
NOTE: If a user answer is "(Skipped)" or extremely brief/empty, give it an ai_score of 0.

IMPORTANT: For each answer, return ONLY an "ai_score" (0-100) reflecting the SEMANTIC quality.
Do NOT factor in keyword matching — that is handled separately by the system.

For each answer also extract:
- "covered_concepts": short labels (2-5 words each) for technical concepts the candidate DID explain well — beyond the predefined key points.
- "missing_concepts": short labels (2-5 words each) for important concepts the candidate FAILED to mention — beyond the predefined key points.
If the answer is "(Skipped)", set both arrays to [].

After evaluating all answers, synthesize the candidate's overall performance:
- "overall_strengths": 2-3 specific technical concepts they mastered
- "overall_weaknesses": 2-3 specific concepts they struggled with or skipped
Do NOT leave these arrays empty.

Respond ONLY with a valid JSON object matching this exact format (no markdown, no extra text):
{
  "evaluations": [
    {
      "ai_score": <integer 0-100>,
      "strengths": "What the candidate did well",
      "weaknesses": "What the candidate missed or got wrong",
      "feedback": "Constructive, specific advice to improve the answer",
      "covered_concepts": ["concept one", "concept two"],
      "missing_concepts": ["concept three", "concept four"]
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

  // ── Hybrid Scoring Logic for Batch (40% Keyword + 60% AI) ────────────────
  let totalFinalScore = 0;
  let scoredCount = 0;

  batchResult.evaluations = batchResult.evaluations.map((evalItem, idx) => {
    const originalAns = answers[idx];

    // Skipped answers get zeroes
    if (!originalAns || originalAns.userAnswer === '(Skipped)') {
      return {
        score:           0,
        correctness_pct: 0,
        keyword_score:   0,
        ai_score:        0,
        covered_points:  [],
        missing_points:  originalAns?.keyPoints || [],
        strengths:       'Not Attempted',
        weaknesses:      'Not Attempted',
        feedback:        'Not Attempted',
        detailed_breakdown: {
           dataset_layer_40_percent: { keyword_score: 0, keyword_math: "0 / N = 0%", covered_key_points: [], missing_key_points: originalAns?.keyPoints || [] },
           ai_layer_60_percent: { ai_score: 0, covered_concepts: [], missing_concepts: [] },
           calculation: { formula: `(0 * 0.4) + (0 * 0.6)`, math: `0 + 0`, final_score: 0 }
        }
      };
    }

    // ── Structural Evaluation: Keyword-Based (40%) ──────────────────────────
    const kwResult  = calculateKeywordScore(originalAns.userAnswer, originalAns.keyPoints || []);
    const kwScore   = kwResult.score;
    const aiScore   = Math.min(100, Math.max(0, evalItem.ai_score ?? 0));

    // Final composite: (kwScore * 0.40) + (aiScore * 0.60)
    const finalScore     = Math.round((kwScore * 0.4) + (aiScore * 0.6));
    const correctnessPct = Math.round((kwResult.matched.length / Math.max((originalAns.keyPoints || []).length, 1)) * 100);

    totalFinalScore += finalScore;
    scoredCount++;

    // ── Merge keyword points with AI-detected concepts ────────────────────
    const coveredPoints = mergePoints(kwResult.matched, evalItem.covered_concepts);
    const missingPoints = mergePoints(kwResult.missed,  evalItem.missing_concepts);

    return {
      score:           finalScore,
      correctness_pct: correctnessPct,
      keyword_score:   kwScore,
      ai_score:        aiScore,
      covered_points:  coveredPoints,
      missing_points:  missingPoints,
      strengths:       evalItem.strengths  || '',
      weaknesses:      evalItem.weaknesses || '',
      feedback:        evalItem.feedback   || '',
      detailed_breakdown: {
        dataset_layer_40_percent: {
          keyword_score: kwScore,
          keyword_math: `${kwResult.matched.length} / ${Math.max((originalAns.keyPoints || []).length, 1)} = ${kwScore}%`,
          covered_key_points: kwResult.matched,
          missing_key_points: kwResult.missed
        },
        ai_layer_60_percent: {
          ai_score: aiScore,
          covered_concepts: evalItem.covered_concepts || [],
          missing_concepts: evalItem.missing_concepts || []
        },
        calculation: {
          formula: `(${kwScore} * 0.4) + (${aiScore} * 0.6)`,
          math: `${(kwScore * 0.4).toFixed(1)} + ${(aiScore * 0.6).toFixed(1)}`,
          final_score: finalScore
        }
      }
    };
  });

  // Recompute overall_score as average of hybrid final scores
  if (scoredCount > 0) {
    batchResult.overall_score = Math.round(totalFinalScore / answers.length); // includes skipped (score=0)
  }

  return batchResult;
}

module.exports = { generateQuestion, evaluateAnswer, evaluateBatch };
