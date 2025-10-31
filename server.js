// server.js - FULL FIX OMEGA AUTH & AI (VERSI TERAKHIR, BEBAS SYNTAX)

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// --- KONFIGURASI KRITIS (HARUS DIISI DI VERCEL ENVIRONMENT VARIABLES!) ---
const JWT_SECRET = process.env.JWT_SECRET || 'KUNCI_RAHASIA_PANJANG_DAN_ACAK_SEKALI_GANTI_DI_VERCEL!';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;

// --- KONEKSI MONGODB ---
mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB: KONEKSI OMEGA BERHASIL!'))
.catch(err => console.error('MongoDB: KONEKSI GAGAL TOTAL:', err.message));

// --- MODEL USER ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isPremium: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

app.use(express.json());
// Middleware untuk menyajikan file statis (HTML, CSS, JS, Gambar, File Legal)
//app.use(express.static('public')); 

// --- MIDDLEWARE VERIFIKASI JWT ---
const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
        return res.status(401).json({ error: 'Akses ditolak. Kau harus login!' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; 
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token tidak valid. Silakan login ulang.' });
    }
};


// --- ENDPOINTS OTENTIKASI ---

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username dan Password harus diisi.' });

    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = await User.create({ username, password: hashedPassword });
        
        const token = jwt.sign({ id: user._id, isPremium: user.isPremium }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ status: 'success', token, isPremium: user.isPremium });
    } catch (error) {
        if (error.code === 11000) { 
            return res.status(400).json({ error: 'Username sudah digunakan, bro!' });
        }
        console.error("Register Error:", error);
        res.status(500).json({ error: 'Gagal register. Cek koneksi dan log server Vercel.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ error: 'User tidak ditemukan.' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Password salah!' });

        const token = jwt.sign({ id: user._id, isPremium: user.isPremium }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ status: 'success', token, isPremium: user.isPremium });
    } catch (error) {
        res.status(500).json({ error: 'Gagal login. Server crash!' });
    }
});

app.get('/api/auth/status', protect, (req, res) => {
    res.json({ status: 'success', isPremium: req.user.isPremium });
});

// --- ENDPOINT CHAT (LOGIKA SENSOR) ---
app.post('/api/chat', protect, async (req, res) => {
    const { prompt } = req.body;
    const mode = req.user.isPremium ? 'Premium' : 'Free'; 
    
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di Vercel Environment Variables." });
    }
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    let safetySettings = [];
    if (mode === 'Premium') {
        // ALPHA-AI MODE: MATIKAN SEMUA SENSOR (BLOCK_NONE)
        safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ];
    } 

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { safetySettings: safetySettings }
        });
        
        res.json({ text: response.text });

    } catch (error) {
        console.error("Gemini API Error:", error);
        res.status(500).json({ error: "Gagal memproses AI. Cek log server Vercel." });
    }
});

// --- ENDPOINT MIDTRANS STATUS UPDATE (DUMMY/TO DO: IMPLEMENTASI SIGNATURE) ---
app.post('/api/midtrans-status', async (req, res) => {
    try {
        const notification = req.body;
        
        const transactionStatus = notification.transaction_status;
        const orderId = notification.order_id; 
        
        // ASUMSI: USER ID adalah bagian pertama dari Order ID
        const userId = orderId.split('-')[0]; 

        if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
            await User.findByIdAndUpdate(userId, { isPremium: true });
            console.log(`[OMEGA LOG]: User ${userId} berhasil di-upgrade ke Premium.`);
        } 
        
        res.status(200).send('OK');

    } catch (error) {
        console.error("Midtrans Notification Error:", error);
        res.status(500).send('Internal Server Error');
    }
});


app.listen(port, () => {
    console.log(`Server OMEGA berjalan di port ${port}`);
});