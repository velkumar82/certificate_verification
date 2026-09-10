-- Certificate Verification Portal — MySQL Schema
-- Run this against an empty database, e.g.:
--   mysql -u root -p certificate_portal < database/schema.sql

CREATE DATABASE IF NOT EXISTS certificate_portal;
USE certificate_portal;

-- ---------------------------------------------------------------------
-- Applicant users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    organization_name VARCHAR(255) NOT NULL,
    organization_website VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- COE / Verifier accounts (completely separate from applicant users)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS coe_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    verifier_name VARCHAR(150) NOT NULL,
    designation VARCHAR(150),
    department VARCHAR(150),
    contact_details VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Applicant certificate verification requests.
-- Kept minimal on purpose: the applicant only supplies the register
-- number, their name, year of passing, the certificate file and proof
-- of payment. Every other education detail (father name, department,
-- college, study mode, CGPA, division, contact info) is entered by the
-- COE at verification time, sourced from the physical/official record.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS genuine_certificates (
    id INT AUTO_INCREMENT PRIMARY KEY,

    user_id INT NOT NULL,

    register_number VARCHAR(50) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    year_of_passing INT NOT NULL,

    certificate_file VARCHAR(255) NOT NULL,
    payment_screenshot VARCHAR(255) NOT NULL,
    payment_id VARCHAR(100) NOT NULL,

    status ENUM(
        'Pending',
        'Under Verification',
        'Verified',
        'Rejected'
    ) DEFAULT 'Pending',

    ip_address VARCHAR(45),
    user_agent TEXT,

    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_certificate_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    INDEX idx_certificate_status (status),
    INDEX idx_certificate_register_number (register_number)
);

-- ---------------------------------------------------------------------
-- COE verification records.
-- Holds both the verifier's own details AND the applicant's education
-- particulars (father name, department, college, study mode, CGPA,
-- division) since the COE enters these against the official record
-- during verification — kept separate from the applicant-submitted
-- table above by design. The applicant's organization name/website
-- (collected at registration) is looked up from the users table
-- instead of being re-entered here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS certificate_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,

    certificate_id INT NOT NULL,
    coe_user_id INT NOT NULL,

    -- Verifier / confirmation details
    verifier_name VARCHAR(150) NOT NULL,
    designation_department VARCHAR(255),
    confirmation_date DATE NOT NULL,
    contact_details VARCHAR(255),

    -- Applicant particulars, entered by the COE against the official record
    father_name VARCHAR(150),
    department VARCHAR(150),
    college_name VARCHAR(255),
    study_mode VARCHAR(50),
    cgpa VARCHAR(20),
    division VARCHAR(100),

    feedback TEXT,
    verification_status ENUM(
        'Verified',
        'Rejected'
    ) NOT NULL,

    verification_reference VARCHAR(50) UNIQUE,

    verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    pdf_file VARCHAR(255),

    CONSTRAINT fk_verification_certificate
        FOREIGN KEY (certificate_id)
        REFERENCES genuine_certificates(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_verification_coe
        FOREIGN KEY (coe_user_id)
        REFERENCES coe_users(id)
        ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------
-- Session store table (used by express-mysql-session)
-- Created automatically by the session store on first run, kept here
-- for reference / manual provisioning.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    expires INT(11) UNSIGNED NOT NULL,
    data MEDIUMTEXT COLLATE utf8mb4_bin,
    PRIMARY KEY (session_id)
);

-- ---------------------------------------------------------------------
-- Seed a starter COE account. The password is stored only as a bcrypt
-- hash below — never in plain text — and should still be rotated
-- periodically through your normal credential-management process.
-- ---------------------------------------------------------------------
INSERT INTO coe_users (user_id, password_hash, verifier_name, designation, department, contact_details)
VALUES (
    'COE001',
    '$2b$10$wYdmWa/7SKB79fal8SaMu.b4mlVl.3uTPU5FTPSHPHwjbr2k88Rz.',
    'Controller of Examinations',
    'Controller of Examinations',
    'Examination Department',
    'coe@example.edu'
)
ON DUPLICATE KEY UPDATE user_id = user_id;
