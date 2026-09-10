const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const PDF_DIR = path.join(__dirname, '..', 'uploads', 'verification-pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const BRAND = '#1f4e5f';
const MUTED = '#6b7280';
const LINE = '#dbe2e6';

const LETTERHEAD = {
    trust: "Theni Melapettai Hindu Nadargal Uravinmurai",
    college: "NADAR SARASWATHI COLLEGE OF ENGINEERING & TECHNOLOGY",
    line1: "Approved by AICTE, New Delhi & Affiliated to Anna University, Chennai",
    line2: "Accredited by NAAC with 'A' Grade | Recognized under 2(f) of the UGC Act, 1956",
    line3: "An ISO 9001:2015 Certified Institution",
    address: "Vadapudupatti, Annanji (PO), Theni - 625531."
};

const PAGE_WIDTH = 595;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 495

// Bottom y-coordinate where page content may start (below the letterhead).
const CONTENT_START_Y = 135;
// Bottom y-coordinate beyond which a new page should be started, leaving
// room for the footer note and page-number band drawn at the bottom.
const PAGE_SAFE_BOTTOM = 750;

/**
 * Draws the institutional letterhead at the top of the current page.
 * Registered against PDFDocument's 'pageAdded' event so it repeats on
 * every page, including ones created by automatic pagination.
 */
function drawLetterhead(doc) {
    let y = 40;

    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
        .text(LETTERHEAD.trust, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 14;

    doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND)
        .text(LETTERHEAD.college, MARGIN, y, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 0.2 });
    y += 18;

    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED)
        .text(LETTERHEAD.line1, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 12;

    doc.text(LETTERHEAD.line2, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 12;

    doc.text(`${LETTERHEAD.line3}  |  ${LETTERHEAD.address}`, MARGIN, y, { width: CONTENT_WIDTH, align: 'center' });
    y += 16;

    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(1.2).strokeColor(BRAND).stroke();
    doc.moveTo(MARGIN, y + 3).lineTo(PAGE_WIDTH - MARGIN, y + 3).lineWidth(0.5).strokeColor(LINE).stroke();
}

/**
 * Ensures there is at least `needed` points of space left on the page
 * before the safe bottom margin; if not, starts a new page (which
 * automatically redraws the letterhead) and returns the new y.
 */
function ensureSpace(doc, y, needed) {
    if (y + needed > PAGE_SAFE_BOTTOM) {
        doc.addPage();
        return CONTENT_START_Y;
    }
    return y;
}

function label(doc, text, y) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
        .text(text.toUpperCase(), 50, y, { characterSpacing: 0.5 });
}

function value(doc, text, y, width) {
    doc.font('Helvetica').fontSize(11).fillColor('#111827')
        .text(text && String(text).trim() ? String(text) : '—', 50, y + 13, { width: width || 250 });
}

function fieldPair(doc, leftLabel, leftValue, rightLabel, rightValue, y) {
    const leftText = leftValue && String(leftValue).trim() ? String(leftValue) : '—';
    const rightText = rightValue && String(rightValue).trim() ? String(rightValue) : '—';

    doc.font('Helvetica').fontSize(11);
    const leftHeight = doc.heightOfString(leftText, { width: 250 });
    const rightHeight = rightLabel ? doc.heightOfString(rightText, { width: 225 }) : 0;
    const rowHeight = Math.max(leftHeight, rightHeight, 14) + 13 + 12; // label + value + gap

    y = ensureSpace(doc, y, rowHeight);
    label(doc, leftLabel, y);
    value(doc, leftValue, y, 250);
    if (rightLabel) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
            .text(rightLabel.toUpperCase(), 320, y, { characterSpacing: 0.5 });
        doc.font('Helvetica').fontSize(11).fillColor('#111827')
            .text(rightText, 320, y + 13, { width: 225 });
    }
    return y + rowHeight;
}

function sectionTitle(doc, text, y) {
    y = ensureSpace(doc, y, 38);
    doc.rect(50, y, 495, 24).fill('#eef3f4');
    doc.font('Helvetica-Bold').fontSize(11).fillColor(BRAND)
        .text(text.toUpperCase(), 60, y + 6, { characterSpacing: 0.5 });
    return y + 24 + 14;
}

/**
 * Generate the certificate / education verification report PDF.
 * @param {object} data - merged certificate + verification data
 * @returns {Promise<{filePath: string, fileName: string}>}
 */
function generateVerificationPDF(data) {
    return new Promise((resolve, reject) => {
        try {
            const fileName = `verification_${data.certificateId}_${Date.now()}.pdf`;
            const filePath = path.join(PDF_DIR, fileName);

            // autoFirstPage is disabled so the very first page also goes
            // through the same 'pageAdded' hook that draws the letterhead —
            // this guarantees the header renders identically on every page,
            // including any pages added by later pagination.
            const doc = new PDFDocument({ size: 'A4', margin: MARGIN, autoFirstPage: false, bufferPages: true });
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            doc.on('pageAdded', () => drawLetterhead(doc));
            doc.addPage();

            let y = CONTENT_START_Y;

            // Report title banner
            doc.rect(50, y, 495, 34).fill(BRAND);
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(14)
                .text('CERTIFICATE / EDUCATION VERIFICATION REPORT', 60, y + 10, { width: 475 });
            y += 34 + 18;

            doc.font('Helvetica').fontSize(9).fillColor(MUTED)
                .text(`Verification Reference: ${data.verificationReference || '—'}`, 50, y);
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 320, y);
            y += 24;

            // Verification information
            y = sectionTitle(doc, 'Verification Information', y);
            y = fieldPair(doc, 'Verifier Name', data.verifierName, 'Date of Confirmation', data.confirmationDate, y);
            y = fieldPair(doc, 'Designation & Department', data.designationDepartment, 'Contact Details', data.contactDetails, y);

            y += 8;

            // Applicant education details (entered by the COE against the official record)
            y = sectionTitle(doc, "Applicant's Education Details", y);
            y = fieldPair(doc, 'Applicant Name', data.studentName, 'Register Number', data.registerNumber, y);
            y = fieldPair(doc, 'Father Name', data.fatherName, 'Year of Passing', data.yearOfPassing, y);
            y = fieldPair(doc, 'Department', data.department, 'Study Mode', data.studyMode, y);
            y = fieldPair(doc, 'College Name', data.collegeName, 'CGPA', data.cgpa, y);
            y = fieldPair(doc, 'Division', data.division, 'Organization Name', data.organizationName, y);
            y = fieldPair(doc, 'Organization Website', data.organizationWebsite, '', '', y);

            y += 8;

            // Verification result
            const statusColor = data.verificationStatus === 'Verified' ? '#1c7c3f' : '#b3261e';
            y = sectionTitle(doc, 'Verification Result', y);
            y = ensureSpace(doc, y, 30);
            doc.font('Helvetica-Bold').fontSize(14).fillColor(statusColor)
                .text(String(data.verificationStatus || '').toUpperCase(), 50, y);
            y += 30;

            // Feedback
            const feedbackText = data.feedback && data.feedback.trim() ? data.feedback : '—';
            doc.font('Helvetica').fontSize(10);
            const feedbackHeight = doc.heightOfString(feedbackText, { width: 495 });
            const feedbackBlockHeight = 13 + feedbackHeight + 15;
            y = ensureSpace(doc, y, feedbackBlockHeight);
            label(doc, 'Feedback', y);
            doc.font('Helvetica').fontSize(10).fillColor('#111827')
                .text(feedbackText, 50, y + 13, { width: 495 });
            y += feedbackBlockHeight;

            // Footer note directly below the last content block on this page.
            // Drawn relative to the actual content end (not a fixed y) so it
            // never forces a spurious blank page when content ends early.
            const footerLineY = y + 10;
            doc.moveTo(50, footerLineY).lineTo(545, footerLineY).strokeColor(LINE).stroke();
            doc.font('Helvetica').fontSize(8).fillColor(MUTED)
                .text('This is a system-generated verification report. It is valid against the verification reference number shown above.', 50, footerLineY + 6, { width: 495 });

            // Stamp page numbers across every page (letterhead already repeats via pageAdded).
            const pageCount = doc.bufferedPageRange().count;
            for (let i = 0; i < pageCount; i++) {
                doc.switchToPage(i);
                doc.font('Helvetica').fontSize(8).fillColor(MUTED)
                    .text(`Page ${i + 1} of ${pageCount}`, 50, 778, { width: 495, align: 'right' });
            }

            doc.end();

            stream.on('finish', () => resolve({ filePath, fileName }));
            stream.on('error', reject);
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = { generateVerificationPDF, PDF_DIR };
