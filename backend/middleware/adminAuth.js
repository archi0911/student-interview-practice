const { authenticate } = require('./auth');

/**
 * Middleware to verify if the authenticated user has the 'admin' role.
 * Relies on the standard `authenticate` middleware having already run,
 * or it can just wrap it for convenience. Current implementation wraps it.
 */
async function adminAuth(req, res, next) {
  // First, run standard authentication
  authenticate(req, res, async () => {
    // Check if the user has the admin role in their metadata
    const role = req.user?.user_metadata?.role;
    
    if (role !== 'admin' && role !== 'faculty') {
      return res.status(403).json({ error: 'Access denied: Requires admin or faculty privileges.' });
    }
    
    // User is an admin, proceed
    next();
  });
}

module.exports = { adminAuth };
