const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const coeController = require('../controllers/coeController');
const requireCoeAuth = require('../middleware/coeAuth');

const coeLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

router.post('/login', coeLoginLimiter, coeController.login);
router.post('/logout', coeController.logout);
router.get('/me', requireCoeAuth, coeController.me);

router.get('/requests', requireCoeAuth, coeController.listRequests);
router.get('/requests/:id', requireCoeAuth, coeController.getRequest);
router.get('/requests/:id/certificate-file', requireCoeAuth, coeController.downloadCertificateFile);
router.get('/requests/:id/payment-screenshot', requireCoeAuth, coeController.downloadPaymentScreenshot);

router.post('/verifications/:certificateId', requireCoeAuth, coeController.submitVerification);
router.get('/verifications/:certificateId/pdf', requireCoeAuth, coeController.downloadPdf);

module.exports = router;
