const bcrypt = require('bcrypt');
const { pool } = require('../config/db');

const SALT_ROUNDS = 10;

async function register(req, res) {
    try {
        const { full_name, email, phone, organization_name, organization_website, password } = req.body;

        if (!full_name || !email || !password || !organization_name) {
            return res.status(400).json({ success: false, message: 'Full name, email, organization name and password are required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'An account with this email already exists' });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, phone, organization_name, organization_website, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
            [
                full_name.trim(),
                email.toLowerCase().trim(),
                phone ? phone.trim() : null,
                organization_name.trim(),
                organization_website ? organization_website.trim() : null,
                passwordHash
            ]
        );

        req.session.userId = result.insertId;

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: { id: result.insertId, full_name, email }
        });
    } catch (err) {
        console.error('register error:', err);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
}

async function login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const [rows] = await pool.query(
            'SELECT id, full_name, email, password_hash, is_active FROM users WHERE email = ?',
            [email.toLowerCase().trim()]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const user = rows[0];
        if (!user.is_active) {
            return res.status(403).json({ success: false, message: 'Account is disabled' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        req.session.userId = user.id;

        res.json({
            success: true,
            message: 'Login successful',
            user: { id: user.id, full_name: user.full_name, email: user.email }
        });
    } catch (err) {
        console.error('login error:', err);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
}

function logout(req, res) {
    req.session.destroy((err) => {
        if (err) {
            console.error('logout error:', err);
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out' });
    });
}

async function me(req, res) {
    try {
        const [rows] = await pool.query(
            'SELECT id, full_name, email, phone, organization_name, organization_website, created_at FROM users WHERE id = ?',
            [req.session.userId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user: rows[0] });
    } catch (err) {
        console.error('me error:', err);
        res.status(500).json({ success: false, message: 'Failed to load profile' });
    }
}

module.exports = { register, login, logout, me };
