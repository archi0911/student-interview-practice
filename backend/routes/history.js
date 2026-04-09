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
      .select('id, mode, context, overall_strengths, overall_weaknesses, created_at, is_verified, overall_score')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return res.json({ success: true, sessions: [] });
    }

    // For each session, fetch responses
    const sessionIds = sessions.map((s) => s.id);

    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('id, session_id, question_text, category, difficulty, user_answer, score, correctness_pct, covered_points, missing_points, strengths, weaknesses, feedback, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: true });

    if (responsesError) throw responsesError;

    const responsesBySessionId = responses.reduce((acc, r) => {
      if (!acc[r.session_id]) acc[r.session_id] = [];
      acc[r.session_id].push(r);
      return acc;
    }, {});

    const enrichedSessions = sessions.map((s) => {
      const rs = responsesBySessionId[s.id] || [];
      
      // Defensively check for truthy is_verified (handles boolean or truthy strings)
      const isVerified = (s.is_verified === true || s.is_verified === 'true' || !!s.is_verified);
      
      if (!isVerified) {
        return {
          ...s,
          questionCount: rs.length,
          averageScore: null,
          overall_strengths: [],
          overall_weaknesses: [],
          responses: rs
        };
      }

      const scores = rs
        .map((r) => r.score)
        .filter((sc) => sc !== undefined && sc !== null);
      const avgScore = s.overall_score !== null && s.overall_score !== undefined
        ? s.overall_score
        : scores.length
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;

      return {
        ...s,
        questionCount: rs.length,
        averageScore: avgScore,
        is_verified: true,
        responses: rs,
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
      .select('id, mode, context, overall_strengths, overall_weaknesses, user_id, created_at, is_verified, overall_score')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    if (session.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Fetch responses
    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('id, question_text, category, difficulty, user_answer, score, correctness_pct, covered_points, missing_points, strengths, weaknesses, feedback, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (responsesError) throw responsesError;

    res.json({
      success: true,
      session: {
        ...session,
        responses: responses,
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
