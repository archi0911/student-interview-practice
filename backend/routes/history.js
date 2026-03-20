const express = require('express');
const { authenticate } = require('../middleware/auth');
const supabase = require('../supabaseClient');

const router = express.Router();

/**
 * GET /api/history
 * Returns all interview sessions for the authenticated user,
 * including questions and their evaluations.
 *
 * Auth: Required
 * Query params:
 *   limit  (optional, default 20)
 *   offset (optional, default 0)
 * Response: { sessions: [...] }
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Fetch sessions for this user
    const { data: sessions, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select('id, mode, context, overall_strengths, overall_weaknesses, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return res.json({ success: true, sessions: [] });
    }

    // For each session, fetch questions + evaluations
    const sessionIds = sessions.map((s) => s.id);

    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, session_id, question_text, ideal_answer, key_points, difficulty, category')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    if (questionsError) throw questionsError;

    const questionIds = questions.map((q) => q.id);

    let evaluations = [];
    if (questionIds.length > 0) {
      const { data: evals, error: evalsError } = await supabase
        .from('evaluations')
        .select(
          'id, question_id, user_answer, score, correctness_pct, covered_points, missing_points, strengths, weaknesses, feedback, created_at'
        )
        .in('question_id', questionIds);

      if (evalsError) throw evalsError;
      evaluations = evals || [];
    }

    // Build nested structure: session → questions → evaluation
    const evalsByQuestionId = evaluations.reduce((acc, e) => {
      acc[e.question_id] = e;
      return acc;
    }, {});

    const questionsBySessionId = questions.reduce((acc, q) => {
      if (!acc[q.session_id]) acc[q.session_id] = [];
      acc[q.session_id].push({
        ...q,
        evaluation: evalsByQuestionId[q.id] || null,
      });
      return acc;
    }, {});

    const enrichedSessions = sessions.map((s) => {
      const qs = questionsBySessionId[s.id] || [];
      const scores = qs
        .map((q) => q.evaluation?.score)
        .filter((sc) => sc !== undefined && sc !== null);
      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

      return {
        ...s,
        questionCount: qs.length,
        averageScore: avgScore,
        questions: qs,
      };
    });

    res.json({ success: true, sessions: enrichedSessions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/history/:sessionId
 * Returns full detail for a single session.
 *
 * Auth: Required
 */
router.get('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, mode, context, overall_strengths, overall_weaknesses, user_id, created_at')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch questions
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, question_text, ideal_answer, key_points, difficulty, category')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (questionsError) throw questionsError;

    const questionIds = questions.map((q) => q.id);
    let evaluations = [];
    if (questionIds.length > 0) {
      const { data: evals, error } = await supabase
        .from('evaluations')
        .select('*')
        .in('question_id', questionIds);
      if (error) throw error;
      evaluations = evals || [];
    }

    const evalsByQId = evaluations.reduce((acc, e) => {
      acc[e.question_id] = e;
      return acc;
    }, {});

    const enrichedQuestions = questions.map((q) => ({
      ...q,
      evaluation: evalsByQId[q.id] || null,
    }));

    res.json({
      success: true,
      session: {
        ...session,
        questions: enrichedQuestions,
      },
    });
  } catch (err) {
    next(err);
  }
});
/**
 * DELETE /api/history/:sessionId
 * Deletes a single interview session.
 *
 * Auth: Required
 */
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Delete the session (Supabase ON DELETE CASCADE will clean up questions/evaluations)
    const { error: deleteError } = await supabase
      .from('interview_sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) throw deleteError;

    res.json({ success: true, message: 'Session deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
