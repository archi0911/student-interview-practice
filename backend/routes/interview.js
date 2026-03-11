const express = require('express');
const { authenticate } = require('../middleware/auth');
const { generateQuestion, evaluateAnswer } = require('../services/geminiService');
const supabase = require('../supabaseClient');
const fs = require('fs');
const path = require('path');
const { normalizeCategory } = require('../utils/categoryNormalizer');

const router = express.Router();
const QUESTIONS_PATH = path.join(__dirname, '../data/questions.json');

/**
 * POST /api/interview/generate
 * Generates a single interview question using Gemini.
 * Saves the question to Supabase and returns it.
 *
 * Auth: Required
 * Body: {
 *   mode: 'resume' | 'role' | 'topic',
 *   context: string,          // skills summary / role name / topic name
 *   category: string,          // 'Technical' | 'HR' | 'Behavioral' | 'Aptitude' | 'Random'
 *   sessionId: string | null   // pass existing session_id to continue, or null for new session
 * }
 * Response: { sessionId, questionId, question, ideal_answer, key_points, difficulty, category }
 */
router.post('/generate', authenticate, async (req, res, next) => {
  try {
    const { mode, context, category = 'Random', sessionId } = req.body;

    if (!mode || !context) {
      return res.status(400).json({ error: 'mode and context are required.' });
    }

    const validModes = ['resume', 'role', 'topic'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `mode must be one of: ${validModes.join(', ')}` });
    }

    // ── Create or reuse session ──────────────────────────────────────────────
    let activeSessionId = sessionId;

    if (!activeSessionId) {
      const { data: session, error: sessionError } = await supabase
        .from('interview_sessions')
        .insert({
          user_id: req.user.id,
          mode,
          context,
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      activeSessionId = session.id;
    }

    // ── Prepare Questions State & Difficulty ─────────────────────────────────
    const { data: pastQuestions, error: pastQuestionsError } = await supabase
      .from('questions')
      .select('question_text')
      .eq('session_id', activeSessionId);

    if (pastQuestionsError) throw pastQuestionsError;

    const askedTexts = pastQuestions.map(q => q.question_text);
    const askedCount = askedTexts.length;

    let targetDifficulty = 'Hard';
    if (askedCount < 3) targetDifficulty = 'Easy';
    else if (askedCount < 7) targetDifficulty = 'Medium';

    // ── Generate question via Local JSON Only ────────────────────────────────
    let generated;
    const fileData = fs.readFileSync(QUESTIONS_PATH, 'utf8');
    const allQs = JSON.parse(fileData);

    // 1. Filter by requested topic/category
    let categoryPool = [];
    if (mode === 'resume') {
       // context is an array of skills passed from the frontend (or comma-separated)
       let skills = Array.isArray(context) ? context : context.split(',');
       let targetCategories = skills.map(s => normalizeCategory(s));
       
       categoryPool = allQs.filter(q => {
         if (!q.category) return false;
         return targetCategories.includes(normalizeCategory(q.category));
       });
    } else {
       const rawCategory = mode === 'topic' ? context : category;
       const targetCategory = normalizeCategory(rawCategory);
       
       categoryPool = allQs.filter(q => {
         if (!q.category) return false;
         return normalizeCategory(q.category) === targetCategory;
       });
    }

    // 2. Remove already asked questions
    categoryPool = categoryPool.filter(q => !askedTexts.includes(q.question));

    // 3. Handle empty category pool
    if (categoryPool.length === 0) {
      return res.status(404).json({ error: 'No matching questions found for your skills in the database.' });
    }

    // 4. Try to match difficulty
    let difficultyPool = categoryPool.filter(q => {
      if (!q.difficulty) return false;
      return q.difficulty.toLowerCase() === targetDifficulty.toLowerCase();
    });

    if (difficultyPool.length > 0) {
      generated = difficultyPool[Math.floor(Math.random() * difficultyPool.length)];
    } else {
      // Fallback to any available difficulty in the pool
      generated = categoryPool[Math.floor(Math.random() * categoryPool.length)];
    }

    // ── Save question to Supabase ────────────────────────────────────────────
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .insert({
        session_id: activeSessionId,
        question_text: generated.question,
        ideal_answer: generated.ideal_answer,
        key_points: generated.key_points,
        difficulty: generated.difficulty,
        category: generated.category,
      })
      .select('id')
      .single();

    if (questionError) throw questionError;

    res.json({
      success: true,
      sessionId: activeSessionId,
      questionId: question.id,
      question: generated.question,
      ideal_answer: generated.ideal_answer,
      key_points: generated.key_points,
      difficulty: generated.difficulty,
      category: generated.category,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/interview/evaluate
 * Evaluates the student's answer against the ideal answer using Gemini.
 * Saves the evaluation to Supabase and returns detailed feedback.
 *
 * Auth: Required
 * Body: {
 *   questionId: string,
 *   userAnswer: string
 * }
 * Response: { score, correctness_pct, covered_points, missing_points, strengths, weaknesses, feedback }
 */
router.post('/evaluate', authenticate, async (req, res, next) => {
  try {
    const { questionId, userAnswer } = req.body;

    if (!questionId || !userAnswer) {
      return res.status(400).json({ error: 'questionId and userAnswer are required.' });
    }

    if (userAnswer.trim().length < 5) {
      return res.status(400).json({ error: 'Answer is too short to evaluate.' });
    }

    // ── Fetch question from Supabase ─────────────────────────────────────────
    const { data: questionRow, error: fetchError } = await supabase
      .from('questions')
      .select('question_text, ideal_answer, key_points, session_id')
      .eq('id', questionId)
      .single();

    if (fetchError || !questionRow) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    // Verify the question belongs to this user's session
    const { data: sessionRow, error: sessionFetchError } = await supabase
      .from('interview_sessions')
      .select('user_id')
      .eq('id', questionRow.session_id)
      .single();

    if (sessionFetchError || sessionRow?.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // ── Evaluate via Gemini ──────────────────────────────────────────────────
    const evaluation = await evaluateAnswer(
      questionRow.question_text,
      questionRow.ideal_answer,
      questionRow.key_points,
      userAnswer
    );

    // ── Save evaluation to Supabase ──────────────────────────────────────────
    const { error: evalError } = await supabase
      .from('evaluations')
      .insert({
        question_id: questionId,
        user_answer: userAnswer,
        score: evaluation.score,
        correctness_pct: evaluation.correctness_pct,
        covered_points: evaluation.covered_points,
        missing_points: evaluation.missing_points,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        feedback: evaluation.feedback,
      });

    if (evalError) throw evalError;

    res.json({
      success: true,
      evaluation,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
