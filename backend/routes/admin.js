const express = require('express');
const { adminAuth } = require('../middleware/adminAuth');
const supabase = require('../supabaseClient');

const router = express.Router();

/**
 * GET /api/admin/stats
 * Returns summary statistics for the dashboard
 */
router.get('/stats', adminAuth, async (req, res, next) => {
  try {
    // 1. Total Students (filter by role)
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;
    const totalStudents = usersData.users.filter(u => u.user_metadata?.role !== 'admin' && u.user_metadata?.role !== 'faculty').length;

    // 2. Session Stats
    const isFaculty = req.user?.user_metadata?.role === 'faculty';
    let sessionQuery = supabase.from('interview_sessions').select('is_verified, overall_score, mode');
    
    if (isFaculty) {
      sessionQuery = sessionQuery.in('mode', ['topic', 'role']);
    }

    const { data: sessions, error: sessionsError } = await sessionQuery;
    if (sessionsError) throw sessionsError;

    const totalInterviews = sessions.length;
    const pendingVerifications = sessions.filter(s => !s.is_verified).length;
    
    // Average Student Score (only from sessions that have a score)
    const sessionsWithScore = sessions.filter(s => s.overall_score !== null);
    const averageScore = sessionsWithScore.length > 0
      ? Math.round(sessionsWithScore.reduce((acc, s) => acc + s.overall_score, 0) / sessionsWithScore.length)
      : 0;

    res.json({
      success: true,
      stats: {
        totalStudents,
        totalInterviews,
        pendingVerifications,
        averageScore
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/sessions/pending
 * Returns all unverified sessions with student info
 */
router.get('/sessions/pending', adminAuth, async (req, res, next) => {
  try {
    const isFaculty = req.user?.user_metadata?.role === 'faculty';
    let query = supabase
      .from('interview_sessions')
      .select('*')
      .eq('is_verified', false)
      .order('created_at', { ascending: false });

    if (isFaculty) {
      query = query.in('mode', ['topic', 'role']);
    }

    const { data: sessions, error: sessionsError } = await query;

    if (sessionsError) throw sessionsError;

    // Fetch users to populate name/email
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const results = sessions.map(s => {
      const u = usersData.users.find(user => user.id === s.user_id);
      return {
        ...s,
        student_name: u?.user_metadata?.full_name || 'N/A',
        student_email: u?.email || 'N/A'
      };
    });

    res.json({ success: true, sessions: results });
  } catch (err) {
    next(err);
  }
});

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
    const isFaculty = req.user?.user_metadata?.role === 'faculty';
    let sessionQuery = supabase.from('interview_sessions').select('user_id, id, mode');
    
    if (isFaculty) {
      sessionQuery = sessionQuery.in('mode', ['topic', 'role']);
    }

    const { data: sessionsData, error: sessionsError } = await sessionQuery;
    if (sessionsError) throw sessionsError;

    // Fetch all responses to calculate actual average scores
    const { data: responsesData, error: respError } = await supabase
      .from('responses')
      .select('score, session_id');
    if (respError) throw respError;

    // Filter users: if faculty, only show actual students (exclude admin and faculty roles)
    const filteredUsersData = isFaculty 
      ? usersData.users.filter(u => u.user_metadata?.role !== 'admin' && u.user_metadata?.role !== 'faculty')
      : usersData.users;

    // Map sessions to users
    const users = filteredUsersData.map(u => {
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
    const isFaculty = req.user?.user_metadata?.role === 'faculty';

    let query = supabase
      .from('interview_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (isFaculty) {
      query = query.in('mode', ['topic', 'role']);
    }

    const { data: sessions, error } = await query;

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
