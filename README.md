# Certificate Verification Portal

A Node.js + Express + MySQL web application implementing the applicant
certificate-verification workflow together with the revised **COE
(Controller of Examinations)** dashboard and education-details verification
workflow. There is no separate COE registration page — the COE signs in
with a COE User ID and Password directly, reviews pending requests, and
verifies each applicant's education details, generating a downloadable
PDF report.

## Features

**Applicant**
- Register / log in (separate session from COE) — registration also
  collects the applicant's **Organization Name** (required) and
  **Organization Website** (optional)
- Submit a certificate verification request with just the essentials:
  Register Number, Student Name, Year of Passing, the certificate file,
  and payment proof (Payment ID + screenshot)
- Track request status (Pending → Under Verification → Verified / Rejected)
- Download the generated verification PDF once verified
- The applicant login page has no link to the COE login, and the COE
  login page has no link back to the applicant login — the two are
  kept fully separate in the UI

**COE / Verifier**
- Dedicated COE login (separate `coe_users` table, separate session key)
- Dashboard listing pending requests with a clickable Register Number
  and the applicant's **Organization Name**
- "Request For Education Details" page:
  - Read-only applicant submission summary, including the applicant's
    Organization Name and Organization Website (pulled automatically
    from their registration — never re-entered by the COE)
  - Direct download links for the applicant's uploaded **certificate
    file** and **payment/transaction screenshot**, so the COE can
    review the original documents before deciding
  - A verification form where the COE enters the applicant's education
    particulars against the official record — Father Name, Department,
    College Name, Study Mode, CGPA, Division — plus verifier info,
    feedback, and the Verified / Rejected decision. (The applicant's
    email and phone number are not collected or displayed anywhere in
    the COE verification flow.)
- Automatic PDF generation with a unique verification reference number
  (e.g. `VER-2026-000001`) that also includes the applicant's
  Organization Name and Website
- COE-side download of the verification PDF, the original certificate,
  and the payment screenshot

**Security**
- bcrypt password hashing for both applicant and COE accounts
- Separate, httpOnly session cookies backed by a MySQL session store
- `requireAuth` / `requireCoeAuth` middleware — a normal applicant can
  never reach `/api/coe/*`
- Rate limiting on both login endpoints
- Helmet security headers
- Parameterized SQL everywhere (no string-built queries)
- File uploads restricted by type (PDF/JPG/PNG/WEBP) and size (5 MB)
- PDF/document downloads check ownership or COE-auth before serving
- IP address / user agent captured on each submission for audit purposes

## Project structure

```
certificate-portal/
├── server.js
├── package.json
├── .env.example
├── config/db.js
├── middleware/{auth.js, coeAuth.js, upload.js}
├── controllers/{authController.js, certificateController.js, coeController.js}
├── routes/{auth.js, certificate.js, coe.js}
├── services/pdfService.js
├── database/schema.sql
├── public/
│   ├── index.html, register.html, portal.html
│   ├── coe/{login.html, dashboard.html, request.html}
│   ├── css/style.css
│   └── js/{login.js, register.js, portal.js, common.js, coe/*.js}
└── uploads/{certificates, payments, verification-pdfs}
```

## Setup

### 1. Prerequisites
- Node.js 18+
- MySQL 8+ (or MariaDB 10.5+)

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment
Copy `.env.example` to `.env` and fill in your MySQL credentials:
```bash
cp .env.example .env
```

```
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-string

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=certificate_portal
```

### 4. Create the database schema
```bash
mysql -u root -p < database/schema.sql
```
This creates all tables and seeds one starter COE account (**User ID:
`COE001`**). The password is stored only as a bcrypt hash in
`database/schema.sql` — it is not written anywhere in plain text in this
project, including this README, for security. Use the credential your
institution has already set for this account to sign in, and rotate it
periodically through your normal credential-management process. To set
a different password later:
```bash
node -e "require('bcrypt').hash('your-new-password', 10).then(console.log)"
```
then
```sql
UPDATE coe_users SET password_hash='<hash from above>' WHERE user_id='COE001';
```

### 5. Add a payment QR code (optional)
Drop your UPI/payment QR image at `public/images/payment-qr.png`. The
applicant form will gracefully hide the image if it's missing.

### 6. Run the server
```bash
npm start
```
or, for auto-reload during development:
```bash
npm run dev
```

The app is now available at **http://localhost:3000**

- Applicant portal: `http://localhost:3000/index.html`
- COE portal: `http://localhost:3000/coe/login.html`

## Data model

```
users
  └─ (1:many) genuine_certificates       — applicant submissions
                └─ (1:0..1) certificate_verifications  — COE verification
                              └─ (many:1) coe_users
```

Applicant data (submission, payment info, certificate file, education
claim) and COE data (verifier name, designation, confirmation date,
contact details, feedback, verification status, PDF) are kept in
separate tables, joined only through `certificate_id`, so applicant and
verifier information never mix.

## Notes

- The session store shares a `sessions` table between applicant and COE
  logins, but `req.session.userId` and `req.session.coeUserId` are
  distinct keys, so one role's session can never authenticate the other.
- The COE verification form pre-fills Verifier Name, Designation &
  Department, Contact Details, and today's date from the logged-in COE
  account; the COE can edit any of these before submitting.
- Uploaded files and generated PDFs are stored on disk under `uploads/`
  with randomized filenames — never the user-supplied original filename.
