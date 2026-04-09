const express = require('express');
const { authenticate } = require('../middleware/auth');
const { evaluateAnswer, evaluateBatch } = require('../services/geminiService');
const supabase = require('../supabaseClient');
const { normalizeCategory } = require('../utils/categoryNormalizer');

const router = express.Router();

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
 * Response: { sessionId, responseId, question, difficulty, category }
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
          context: Array.isArray(context) ? context.join(', ') : context,
        })
        .select('id')
        .single();

      if (sessionError) throw sessionError;
      activeSessionId = session.id;
    }

    // ── Prepare Questions State & Difficulty ─────────────────────────────────
    const { data: pastQuestions, error: pastQuestionsError } = await supabase
      .from('responses')
      .select('question_text')
      .eq('session_id', activeSessionId);

    if (pastQuestionsError) throw pastQuestionsError;

    const askedTexts = pastQuestions.map(q => q.question_text);
    const askedCount = askedTexts.length;

    let targetDifficulty = 'Hard';
    if (askedCount < 3) targetDifficulty = 'Easy';
    else if (askedCount < 7) targetDifficulty = 'Medium';

    // ── Generate question via Supabase question_bank ──────────────────────────
    let generated;
    let query = supabase.from('question_bank').select('*');

    // 1. Apply category filtering based on mode
    if (mode === 'resume') {
       let skills = Array.isArray(context) ? context : context.split(',');
       let targetCategories = skills.map(s => normalizeCategory(s));
       query = query.in('category', targetCategories);
    } else if (mode === 'topic') {
       let topics = Array.isArray(context) ? context : [context];
       let targetCategories = topics.map(s => normalizeCategory(s));
       query = query.in('category', targetCategories);
    } else if (mode === 'role') {
       if (context === 'Full Stack Developer') {
         query = query.in('category', ['frontend-developer', 'backend-developer']);
       } else {
         const targetRoleCategory = normalizeCategory(context);
         query = query.eq('category', targetRoleCategory);
       }
    } else {
       const targetCategory = normalizeCategory(category);
       query = query.eq('category', targetCategory);
    }

    const { data: categoryPool, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    // 2. Remove already asked questions (In-memory filter for now)
    let availablePool = (categoryPool || []).filter(q => !askedTexts.includes(q.question_text));

    // 3. Handle empty pool
    if (availablePool.length === 0) {
      return res.status(404).json({ 
        error: 'No more matching questions found in the database. try a different topic or role.' 
      });
    }

    // 4. Try to match difficulty
    let difficultyPool = availablePool.filter(q => {
      if (!q.difficulty) return false;
      return q.difficulty.toLowerCase() === targetDifficulty.toLowerCase();
    });

    if (difficultyPool.length > 0) {
      generated = difficultyPool[Math.floor(Math.random() * difficultyPool.length)];
    } else {
      // Fallback to any available difficulty in the pool
      generated = availablePool[Math.floor(Math.random() * availablePool.length)];
    }

    // ── Save question to Supabase ────────────────────────────────────────────
    const { data: responseRow, error: responseError } = await supabase
      .from('responses')
      .insert({
        session_id: activeSessionId,
        question_bank_id: generated.id,
        question_text: generated.question_text,
        difficulty: generated.difficulty ? (generated.difficulty.charAt(0).toUpperCase() + generated.difficulty.slice(1)) : 'Medium',
        category: generated.category,
      })
      .select('id')
      .single();

    if (responseError) throw responseError;

    res.json({
      success: true,
      sessionId: activeSessionId,
      responseId: responseRow.id,
      question: generated.question_text,
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
 *   responseId: string,
 *   userAnswer: string
 * }
 * Response: { score, correctness_pct, covered_points, missing_points, strengths, weaknesses, feedback }
 */
router.post('/evaluate', authenticate, async (req, res, next) => {
  try {
    const { responseId, userAnswer } = req.body;

    if (!responseId || !userAnswer) {
      return res.status(400).json({ error: 'responseId and userAnswer are required.' });
    }

    if (userAnswer.trim().length < 5) {
      return res.status(400).json({ error: 'Answer is too short to evaluate.' });
    }

    // ── Fetch response from Supabase ─────────────────────────────────────────
    const { data: responseRow, error: fetchError } = await supabase
      .from('responses')
      .select('question_text, session_id, question_bank_id')
      .eq('id', responseId)
      .single();

    if (fetchError || !responseRow) {
      return res.status(404).json({ error: 'Response not found.' });
    }

    // Verify the response belongs to this user's session
    const { data: sessionRow, error: sessionFetchError } = await supabase
      .from('interview_sessions')
      .select('user_id')
      .eq('id', responseRow.session_id)
      .single();

    if (sessionFetchError || sessionRow?.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch key_points and ideal_answer from question_bank
    let ideal_answer = '';
    let key_points = [];
    if (responseRow.question_bank_id) {
      const { data: qbRow } = await supabase.from('question_bank').select('ideal_answer, key_points').eq('id', responseRow.question_bank_id).single();
      if (qbRow) {
        ideal_answer = qbRow.ideal_answer;
        key_points = qbRow.key_points;
      }
    }

    // ── Evaluate via Gemini ──────────────────────────────────────────────────
    const evaluation = await evaluateAnswer(
      responseRow.question_text,
      ideal_answer,
      key_points,
      userAnswer
    );

    // ── Update response in Supabase ──────────────────────────────────────────
    const { error: evalError } = await supabase
      .from('responses')
      .update({
        user_answer: userAnswer,
        score: evaluation.score,
        correctness_pct: evaluation.correctness_pct,
        covered_points: evaluation.covered_points,
        missing_points: evaluation.missing_points,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        feedback: JSON.stringify({
          text: evaluation.feedback || '',
          detailed_breakdown: evaluation.detailed_breakdown || null
        }),
      })
      .eq('id', responseId);

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
 *   answers: [{ responseId, question, userAnswer }, ...]
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
        
        // ── Fetch responses and question_bank_ids ────────────────────────────────
        const responseIds = answers.map(a => a.responseId);
        const { data: dbResponses, error: responsesError } = await supabase
          .from('responses')
          .select('id, question_bank_id')
          .in('id', responseIds);

        if (responsesError) throw responsesError;

        const qbIds = dbResponses.map(r => r.question_bank_id).filter(Boolean);
        let qbMap = {};
        if (qbIds.length > 0) {
           const { data: dbQb } = await supabase.from('question_bank').select('id, key_points').in('id', qbIds);
           if (dbQb) {
             dbQb.forEach(qb => qbMap[qb.id] = qb.key_points || []);
           }
        }

        const keyPointsMap = dbResponses.reduce((acc, r) => {
          acc[r.id] = r.question_bank_id ? (qbMap[r.question_bank_id] || []) : [];
          return acc;
        }, {});

        // Call Gemini for only the attempted questions
        const payloadForGemini = answers
          .filter(a => a.userAnswer !== '(Skipped)')
          .map(a => ({
            question: a.question,
            userAnswer: a.userAnswer,
            keyPoints: keyPointsMap[a.responseId] || []
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

        // Update responses in Supabase
        const dbUpdates = answers.map((ans, idx) => ({
          id: ans.responseId,
          user_answer: ans.userAnswer,
          score: evaluations[idx]?.score || 0,
          correctness_pct: evaluations[idx]?.correctness_pct || 0,
          covered_points: evaluations[idx]?.covered_points || [],
          missing_points: evaluations[idx]?.missing_points || [],
          strengths: evaluations[idx]?.strengths || '',
          weaknesses: evaluations[idx]?.weaknesses || '',
          feedback: JSON.stringify({
            text: evaluations[idx]?.feedback || 'No feedback generated',
            detailed_breakdown: evaluations[idx]?.detailed_breakdown || null
          }),
        }));

        await Promise.all(dbUpdates.map(async updateData => {
           const { id, ...rest } = updateData;
           const { error: evalError } = await supabase.from('responses').update(rest).eq('id', id);
           if (evalError) console.error(`Failed to update response ${id}:`, evalError);
        }));

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
