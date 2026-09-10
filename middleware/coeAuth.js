// COE authentication middleware.
// Uses req.session.coeUserId — never shared with the applicant session.
// A normal applicant must never be able to reach /api/coe/* routes.
function requireCoeAuth(req, res, next) {
    if (!req.session || !req.session.coeUserId) {
        return res.status(401).json({
            success: false,
            message: 'COE authentication required'
        });
    }
    next();
}

module.exports = requireCoeAuth;
