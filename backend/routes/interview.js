const express = require('express');
const { authenticate } = require('../middleware/auth');
const { generateQuestion, evaluateAnswer, evaluateBatch } = require('../services/geminiService');
const supabase = require('../supabaseClient');
const fs = require('fs');
const path = require('path');
const { normalizeCategory } = require('../utils/categoryNormalizer');

const router = express.Router();
const QUESTIONS_PATH = path.join(__dirname, '../data/questions.json');
const JOB_ROLE_QUESTIONS_PATH = path.join(__dirname, '../data/jobRoleQuestions.json');

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
    } else if (mode === 'topic') {
       // context can be an array of topics or a single string
       let topics = Array.isArray(context) ? context : [context];
       let targetCategories = topics.map(s => normalizeCategory(s));
       
       categoryPool = allQs.filter(q => {
         if (!q.category) return false;
         return targetCategories.includes(normalizeCategory(q.category));
       });
    } else if (mode === 'role') {
       // context is the job role name (e.g., 'Frontend Developer')
       const roleData = fs.readFileSync(JOB_ROLE_QUESTIONS_PATH, 'utf8');
       const roleQs = JSON.parse(roleData);
       
       if (context === 'Full Stack Developer') {
         // Mix frontend and backend
         categoryPool = roleQs.filter(q => 
           q.category === 'frontend-developer' || q.category === 'backend-developer'
         );
       } else {
         const targetRoleCategory = normalizeCategory(context);
         categoryPool = roleQs.filter(q => {
           if (!q.category) return false;
           return normalizeCategory(q.category) === targetRoleCategory;
         });
       }
    } else {
       const targetCategory = normalizeCategory(category);
       
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

/**
 * POST /api/interview/evaluate-batch
 * Evaluates a batch of answers simultaneously at the end of the session.
 *
 * Auth: Required
 * Body: {
 *   sessionId: string,
 *   answers: [{ questionId, question, userAnswer }, ...]
 * }
 */
router.post('/evaluate-batch', authenticate, async (req, res, next) => {
  try {
    const { sessionId, answers } = req.body;

    if (!sessionId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'sessionId and answers array are required.' });
    }

    if (answers.length === 0) {
      return res.json({ success: true, results: [] });
    }

    // Verify the session belongs to this user
    const { data: sessionRow, error: sessionFetchError } = await supabase
      .from('interview_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single();

    if (sessionFetchError || sessionRow?.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      message: "Evaluation started. Your results will be processed shortly."
    });

    // ── BACKGROUND TASK: Gemini Evaluation ──────────────────────────────────
    (async () => {
      try {
        console.log(`[BACKGROUND] Starting batch evaluation for session: ${sessionId}`);
        
        // Call Gemini for only the attempted questions
        const payloadForGemini = answers
          .filter(a => a.userAnswer !== '(Skipped)')
          .map(a => ({
            question: a.question,
            userAnswer: a.userAnswer
          }));

        let geminiEvaluations = [];
        let overallStrengths = [];
        let overallWeaknesses = [];
        let overallScore = null;

        if (payloadForGemini.length > 0) {
          const geminiResponse = await evaluateBatch(payloadForGemini);
          if (!geminiResponse || !Array.isArray(geminiResponse.evaluations)) {
            throw new Error("Gemini returned invalid response format for batch.");
          }
          geminiEvaluations = geminiResponse.evaluations;
          overallStrengths = geminiResponse.overall_strengths || [];
          overallWeaknesses = geminiResponse.overall_weaknesses || [];
          overallScore = geminiResponse.overall_score ?? null;
        }

        // Merge Gemini evaluations and Dummy evaluations for Skipped
        let geminiIndex = 0;
        const evaluations = answers.map(a => {
          if (a.userAnswer === '(Skipped)') {
            return {
              score: 0,
              correctness_pct: 0,
              covered_points: [],
              missing_points: ["Not Attempted"],
              strengths: "Not Attempted",
              weaknesses: "Not Attempted",
              feedback: "Not Attempted"
            };
          } else {
            return geminiEvaluations[geminiIndex++] || {};
          }
        });

        // Save evaluations to Supabase
        const dbInserts = answers.map((ans, idx) => ({
          question_id: ans.questionId,
          user_answer: ans.userAnswer,
          score: evaluations[idx]?.score || 0,
          correctness_pct: evaluations[idx]?.correctness_pct || 0,
          covered_points: evaluations[idx]?.covered_points || [],
          missing_points: evaluations[idx]?.missing_points || [],
          strengths: evaluations[idx]?.strengths || '',
          weaknesses: evaluations[idx]?.weaknesses || '',
          feedback: evaluations[idx]?.feedback || 'No feedback generated',
        }));

        const { error: evalError } = await supabase
          .from('evaluations')
          .insert(dbInserts);

        if (evalError) throw evalError;

        // Update session with results
        const { error: sessionUpdateError } = await supabase
          .from('interview_sessions')
          .update({
            overall_strengths: overallStrengths,
            overall_weaknesses: overallWeaknesses,
            overall_score: overallScore
          })
          .eq('id', sessionId);

        if (sessionUpdateError) throw sessionUpdateError;
        console.log(`[BACKGROUND] Batch evaluation complete for session: ${sessionId}`);

      } catch (err) {
        console.error(`[BACKGROUND ERROR] Batch evaluation failed for session ${sessionId}:`, err.message);
      }
    })();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
