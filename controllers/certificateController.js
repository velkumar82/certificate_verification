const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');

const REQUIRED_FIELDS = ['register_number', 'student_name', 'year_of_passing', 'payment_id'];

async function submit(req, res) {
    try {
        const body = req.body;

        for (const field of REQUIRED_FIELDS) {
            if (!body[field] || !String(body[field]).trim()) {
                return res.status(400).json({ success: false, message: `${field.replace(/_/g, ' ')} is required` });
            }
        }

        const year = parseInt(body.year_of_passing, 10);
        if (!Number.isInteger(year) || year < 1980 || year > 2100) {
            return res.status(400).json({ success: false, message: 'Please enter a valid year of passing' });
        }

        if (!req.files || !req.files.certificate_file || !req.files.payment_screenshot) {
            return res.status(400).json({ success: false, message: 'Certificate file and payment screenshot are both required' });
        }

        const certificateFile = req.files.certificate_file[0].filename;
        const paymentScreenshot = req.files.payment_screenshot[0].filename;

        const [result] = await pool.query(
            `INSERT INTO genuine_certificates (
                user_id, register_number, student_name, year_of_passing,
                certificate_file, payment_screenshot, payment_id,
                ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.session.userId,
                body.register_number.trim(),
                body.student_name.trim(),
                year,
                certificateFile,
                paymentScreenshot,
                body.payment_id.trim(),
                req.ip,
                req.get('User-Agent') || null
            ]
        );

        res.status(201).json({
            success: true,
            message: 'Verification request submitted successfully',
            id: result.insertId
        });
    } catch (err) {
        console.error('submit error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit verification request' });
    }
}

async function myRequests(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT gc.id, gc.register_number, gc.student_name, gc.year_of_passing,
                    gc.status, gc.submitted_at,
                    cv.verification_status, cv.feedback, cv.verified_at, cv.pdf_file
             FROM genuine_certificates gc
             LEFT JOIN certificate_verifications cv ON cv.certificate_id = gc.id
             WHERE gc.user_id = ?
             ORDER BY gc.submitted_at DESC`,
            [req.session.userId]
        );
        res.json({ success: true, requests: rows });
    } catch (err) {
        console.error('myRequests error:', err);
        res.status(500).json({ success: false, message: 'Failed to load requests' });
    }
}

async function downloadPdf(req, res) {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT gc.id, gc.user_id, cv.pdf_file
             FROM genuine_certificates gc
             JOIN certificate_verifications cv ON cv.certificate_id = gc.id
             WHERE gc.id = ?`,
            [id]
        );

        if (rows.length === 0 || !rows[0].pdf_file) {
            return res.status(404).json({ success: false, message: 'Verification PDF not found' });
        }

        const record = rows[0];

        // A user must never be able to download another user's PDF.
        if (record.user_id !== req.session.userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to access this file' });
        }

        const filePath = path.join(__dirname, '..', 'uploads', 'verification-pdfs', record.pdf_file);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'File missing on server' });
        }

        res.download(filePath, `verification_${id}.pdf`);
    } catch (err) {
        console.error('downloadPdf error:', err);
        res.status(500).json({ success: false, message: 'Failed to download PDF' });
    }
}

module.exports = { submit, myRequests, downloadPdf };
