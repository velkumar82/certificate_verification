// Applicant authentication middleware.
// Uses req.session.userId — completely separate from the COE session.
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required'
        });
    }
    next();
}

module.exports = requireAuth;
