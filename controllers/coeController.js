const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');
const { generateVerificationPDF } = require('../services/pdfService');

// ---------------------------------------------------------------------
// COE Login
// ---------------------------------------------------------------------
async function login(req, res) {
    try {
        const { user_id, password } = req.body;
        if (!user_id || !password) {
            return res.status(400).json({ success: false, message: 'User ID and password are required' });
        }

        const [rows] = await pool.query(
            `SELECT id, user_id, password_hash, verifier_name, designation, department, contact_details, is_active
             FROM coe_users WHERE user_id = ?`,
            [user_id.trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid COE User ID or password' });
        }

        const coe = rows[0];
        if (!coe.is_active) {
            return res.status(403).json({ success: false, message: 'This COE account is disabled' });
        }

        const match = await bcrypt.compare(password, coe.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid COE User ID or password' });
        }

        // Separate session property — never shares state with applicant sessions.
        req.session.coeUserId = coe.id;

        res.json({
            success: true,
            message: 'Login successful',
            coe: {
                id: coe.id,
                user_id: coe.user_id,
                verifier_name: coe.verifier_name,
                designation: coe.designation,
                department: coe.department,
                contact_details: coe.contact_details
            }
        });
    } catch (err) {
        console.error('coe login error:', err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
}

function logout(req, res) {
    req.session.coeUserId = null;
    req.session.destroy((err) => {
        if (err) {
            console.error('coe logout error:', err);
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out' });
    });
}

async function me(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT id, user_id, verifier_name, designation, department, contact_details
             FROM coe_users WHERE id = ?`,
            [req.session.coeUserId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'COE account not found' });
        }
        res.json({ success: true, coe: rows[0] });
    } catch (err) {
        console.error('coe me error:', err);
        res.status(500).json({ success: false, message: 'Failed to load COE profile' });
    }
}

// ---------------------------------------------------------------------
// Dashboard: pending / all requests
// ---------------------------------------------------------------------
async function listRequests(req, res) {
    try {
        const statusFilter = req.query.status; // optional: Pending | Under Verification | Verified | Rejected

        let query = `
            SELECT gc.id, gc.register_number, gc.student_name, gc.year_of_passing,
                   gc.status, gc.submitted_at, u.organization_name
            FROM genuine_certificates gc
            JOIN users u ON u.id = gc.user_id
        `;
        const params = [];

        if (statusFilter) {
            query += ' WHERE gc.status = ?';
            params.push(statusFilter);
        } else {
            query += " WHERE gc.status IN ('Pending', 'Under Verification')";
        }

        query += ' ORDER BY gc.submitted_at ASC';

        const [rows] = await pool.query(query, params);
        res.json({ success: true, requests: rows });
    } catch (err) {
        console.error('listRequests error:', err);
        res.status(500).json({ success: false, message: 'Failed to load requests' });
    }
}

// ---------------------------------------------------------------------
// Request For Education Details — single request detail
// ---------------------------------------------------------------------
async function getRequest(req, res) {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT gc.*, u.organization_name, u.organization_website,
                    cv.verifier_name AS v_verifier_name, cv.designation_department, cv.confirmation_date,
                    cv.contact_details AS v_contact_details, cv.father_name, cv.department, cv.college_name,
                    cv.study_mode, cv.cgpa, cv.division,
                    cv.feedback, cv.verification_status, cv.verification_reference, cv.verified_at, cv.pdf_file
             FROM genuine_certificates gc
             JOIN users u ON u.id = gc.user_id
             LEFT JOIN certificate_verifications cv ON cv.certificate_id = gc.id
             WHERE gc.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
        }

        const [coeRows] = await pool.query(
            'SELECT verifier_name, designation, department, contact_details FROM coe_users WHERE id = ?',
            [req.session.coeUserId]
        );

        res.json({
            success: true,
            request: rows[0],
            coeDefaults: coeRows[0] || null
        });
    } catch (err) {
        console.error('getRequest error:', err);
        res.status(500).json({ success: false, message: 'Failed to load request' });
    }
}

// ---------------------------------------------------------------------
// Submit verification (Verified / Rejected) + generate PDF
// The COE enters the applicant's education particulars here (father
// name, department, college, study mode, CGPA, division) since the
// applicant's own submission only contains register number, name and
// year of passing. The applicant's organization name/website (from
// registration) is looked up automatically, not re-entered by the COE.
// ---------------------------------------------------------------------
async function submitVerification(req, res) {
    const conn = await pool.getConnection();
    try {
        const { certificateId } = req.params;
        const coeUserId = req.session.coeUserId; // never trust a client-supplied coe_user_id

        const {
            verifier_name,
            designation_department,
            confirmation_date,
            contact_details,
            father_name,
            department,
            college_name,
            study_mode,
            cgpa,
            division,
            feedback,
            verification_status
        } = req.body;

        if (!verifier_name || !verifier_name.trim()) {
            return res.status(400).json({ success: false, message: 'Verifier name is required' });
        }
        if (!confirmation_date) {
            return res.status(400).json({ success: false, message: 'Date of confirmation is required' });
        }
        if (!['Verified', 'Rejected'].includes(verification_status)) {
            return res.status(400).json({ success: false, message: 'Verification status must be Verified or Rejected' });
        }

        await conn.beginTransaction();

        const [certRows] = await conn.query(
            `SELECT gc.*, u.organization_name, u.organization_website
             FROM genuine_certificates gc
             JOIN users u ON u.id = gc.user_id
             WHERE gc.id = ? FOR UPDATE`,
            [certificateId]
        );
        if (certRows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Certificate request not found' });
        }
        const certificate = certRows[0];

        const [existing] = await conn.query(
            'SELECT id FROM certificate_verifications WHERE certificate_id = ?',
            [certificateId]
        );
        if (existing.length > 0) {
            await conn.rollback();
            return res.status(409).json({ success: false, message: 'This request has already been verified' });
        }

        // Generate a unique verification reference number, e.g. VER-2026-000001
        const year = new Date().getFullYear();
        const [countRows] = await conn.query(
            'SELECT COUNT(*) AS cnt FROM certificate_verifications WHERE YEAR(verified_at) = ?',
            [year]
        );
        const seq = (countRows[0].cnt + 1).toString().padStart(6, '0');
        const verificationReference = `VER-${year}-${seq}`;

        const [insertResult] = await conn.query(
            `INSERT INTO certificate_verifications (
                certificate_id, coe_user_id, verifier_name, designation_department,
                confirmation_date, contact_details, father_name, department, college_name,
                study_mode, cgpa, division,
                feedback, verification_status, verification_reference
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                certificateId, coeUserId, verifier_name.trim(), designation_department || null,
                confirmation_date, contact_details || null,
                father_name || null, department || null, college_name || null,
                study_mode || null, cgpa || null, division || null,
                feedback || null, verification_status, verificationReference
            ]
        );

        const newStatus = verification_status === 'Verified' ? 'Verified' : 'Rejected';
        await conn.query('UPDATE genuine_certificates SET status = ? WHERE id = ?', [newStatus, certificateId]);

        // Generate the PDF report.
        const { fileName } = await generateVerificationPDF({
            certificateId,
            verifierName: verifier_name.trim(),
            designationDepartment: designation_department,
            confirmationDate: confirmation_date,
            contactDetails: contact_details,
            studentName: certificate.student_name,
            registerNumber: certificate.register_number,
            yearOfPassing: certificate.year_of_passing,
            fatherName: father_name,
            department: department,
            collegeName: college_name,
            studyMode: study_mode,
            cgpa: cgpa,
            division: division,
            organizationName: certificate.organization_name,
            organizationWebsite: certificate.organization_website,
            verificationStatus: verification_status,
            feedback: feedback,
            verificationReference
        });

        await conn.query(
            'UPDATE certificate_verifications SET pdf_file = ? WHERE id = ?',
            [fileName, insertResult.insertId]
        );

        await conn.commit();

        res.status(201).json({
            success: true,
            message: `Request ${verification_status.toLowerCase()} successfully`,
            verificationReference,
            pdfFile: fileName
        });
    } catch (err) {
        await conn.rollback();
        console.error('submitVerification error:', err);
        res.status(500).json({ success: false, message: 'Failed to submit verification' });
    } finally {
        conn.release();
    }
}

// ---------------------------------------------------------------------
// COE verification-PDF download
// ---------------------------------------------------------------------
async function downloadPdf(req, res) {
    try {
        const { certificateId } = req.params;

        const [rows] = await pool.query(
            'SELECT pdf_file FROM certificate_verifications WHERE certificate_id = ?',
            [certificateId]
        );

        if (rows.length === 0 || !rows[0].pdf_file) {
            return res.status(404).json({ success: false, message: 'Verification PDF not found' });
        }

        const filePath = path.join(__dirname, '..', 'uploads', 'verification-pdfs', rows[0].pdf_file);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'File missing on server' });
        }

        res.download(filePath, `verification_${certificateId}.pdf`);
    } catch (err) {
        console.error('coe downloadPdf error:', err);
        res.status(500).json({ success: false, message: 'Failed to download PDF' });
    }
}

// ---------------------------------------------------------------------
// COE download of the applicant's originally uploaded certificate file
// ---------------------------------------------------------------------
async function downloadCertificateFile(req, res) {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT certificate_file FROM genuine_certificates WHERE id = ?',
            [id]
        );
        if (rows.length === 0 || !rows[0].certificate_file) {
            return res.status(404).json({ success: false, message: 'Certificate file not found' });
        }

        const filePath = path.join(__dirname, '..', 'uploads', 'certificates', rows[0].certificate_file);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'File missing on server' });
        }

        res.download(filePath, `certificate_${id}${path.extname(rows[0].certificate_file)}`);
    } catch (err) {
        console.error('downloadCertificateFile error:', err);
        res.status(500).json({ success: false, message: 'Failed to download certificate file' });
    }
}

// ---------------------------------------------------------------------
// COE download of the applicant's payment / transaction screenshot
// ---------------------------------------------------------------------
async function downloadPaymentScreenshot(req, res) {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT payment_screenshot FROM genuine_certificates WHERE id = ?',
            [id]
        );
        if (rows.length === 0 || !rows[0].payment_screenshot) {
            return res.status(404).json({ success: false, message: 'Payment screenshot not found' });
        }

        const filePath = path.join(__dirname, '..', 'uploads', 'payments', rows[0].payment_screenshot);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'File missing on server' });
        }

        res.download(filePath, `payment_${id}${path.extname(rows[0].payment_screenshot)}`);
    } catch (err) {
        console.error('downloadPaymentScreenshot error:', err);
        res.status(500).json({ success: false, message: 'Failed to download payment screenshot' });
    }
}

module.exports = {
    login, logout, me, listRequests, getRequest, submitVerification, downloadPdf,
    downloadCertificateFile, downloadPaymentScreenshot
};
