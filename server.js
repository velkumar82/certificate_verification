require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const { pool, testConnection } = require('./config/db');

const authRoutes = require('./routes/auth');
const certificateRoutes = require('./routes/certificate');
const coeRoutes = require('./routes/coe');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(helmet({
    contentSecurityPolicy: false // relax CSP for the static demo frontend; tighten for production
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// MySQL-backed session store — shared table for both applicant and COE
// sessions, but the two roles never read or write each other's session key.
const sessionStore = new MySQLStore({}, pool);

app.use(session({
    key: 'connect.sid',
    secret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 8 // 8 hours
    }
}));

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads/verification-pdfs', express.static(path.join(__dirname, 'uploads', 'verification-pdfs'), {
    // Served only through authenticated download endpoints in practice;
    // this static mount is kept disabled from directory listing.
    index: false,
    redirect: false
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/coe', coeRoutes);

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Not found' });
});

// Centralized error handler (e.g. multer file-size / type errors)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Something went wrong'
    });
});

testConnection().then(() => {
    app.listen(PORT, () => {
        console.log(`Certificate Portal running on http://localhost:${PORT}`);
    });
});
