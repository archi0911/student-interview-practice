const express = require('express');
const { adminAuth } = require('../middleware/adminAuth');
const supabase = require('../supabaseClient');

const router = express.Router();

/**
 * GET /api/admin/users
 * Returns a list of all users and their basic statistics.
 */
router.get('/users', adminAuth, async (req, res, next) => {
  try {
    // Fetch all users from Supabase Auth
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    // Fetch all sessions to link users to their sessions and evaluations
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('interview_sessions')
      .select('user_id, id');
    if (sessionsError) throw sessionsError;

    // Fetch all responses to calculate actual average scores
    const { data: responsesData, error: respError } = await supabase
      .from('responses')
      .select('score, session_id');
    if (respError) throw respError;

    // Map sessions to users
    const users = usersData.users.map(u => {
      const userSessions = sessionsData.filter(s => s.user_id === u.id);
      const userSessionIds = userSessions.map(s => s.id);
      
      // Get all responses that belong to this user's sessions
      const userResps = responsesData.filter(e => 
        e.session_id && userSessionIds.includes(e.session_id)
      );

      let avgScore = 0;
      if (userResps.length > 0) {
        avgScore = Math.round(userResps.reduce((acc, e) => acc + (e.score || 0), 0) / userResps.length);
      }

      return {
        id: u.id,
        email: u.email,
        full_name: u.user_metadata?.full_name || 'N/A',
        created_at: u.created_at,
        role: u.user_metadata?.role || 'student',
        session_count: userSessions.length,
        avg_score: avgScore
      };
    });

    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/users/:userId/sessions
 * Returns all sessions for a specific user
 */
router.get('/users/:userId/sessions', adminAuth, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const { data: sessions, error } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Fetch the user details to include in the response
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) throw userError;

    res.json({
      success: true,
      user: {
        id: userData.user.id,
        email: userData.user.email,
        full_name: userData.user.user_metadata?.full_name || 'N/A'
      },
      sessions
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/sessions/:sessionId
 * Returns full details of a specific session (questions + evaluations)
 */
router.get('/sessions/:sessionId', adminAuth, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('interview_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Fetch responses for the session
    const { data: responses, error: responsesError } = await supabase
      .from('responses')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (responsesError) throw responsesError;

    res.json({
      success: true,
      session,
      responses
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/responses/:id
 * Updates specific fields for a response (e.g., missing_points)
 */
router.put('/responses/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { score, missing_points } = req.body;

    const updates = {};
    if (score !== undefined) updates.score = score;
    if (missing_points !== undefined) updates.missing_points = missing_points;

    const { data: updatedResp, error } = await supabase
      .from('responses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, response: updatedResp });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/sessions/:id
 * Updates specific fields for an interview session (e.g., overall_strengths, overall_weaknesses)
 */
router.put('/sessions/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { overall_strengths, overall_weaknesses, is_verified, overall_score } = req.body;

    const updates = {};
    if (overall_strengths !== undefined) updates.overall_strengths = overall_strengths;
    if (overall_weaknesses !== undefined) updates.overall_weaknesses = overall_weaknesses;
    if (is_verified !== undefined) updates.is_verified = is_verified;
    if (overall_score !== undefined) updates.overall_score = overall_score;

    const { data: updatedSession, error } = await supabase
      .from('interview_sessions')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      throw error;
    }
    
    if (!updatedSession || updatedSession.length === 0) {
      throw new Error(`Session with ID ${id} not found or no changes made.`);
    }

    res.json({ success: true, session: updatedSession[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/sessions/:id
 * Permanently deletes an interview session and its cascading data
 */
router.delete('/sessions/:id', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('interview_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
