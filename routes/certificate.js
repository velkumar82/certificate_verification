const express = require('express');
const router = express.Router();

const certificateController = require('../controllers/certificateController');
const requireAuth = require('../middleware/auth');
const { submitUpload } = require('../middleware/upload');

router.post('/submit', requireAuth, submitUpload, certificateController.submit);
router.get('/my', requireAuth, certificateController.myRequests);
router.get('/:id/pdf', requireAuth, certificateController.downloadPdf);

module.exports = router;
