// server.js - FULL FIX OMEGA (VERSI FINAL TERBAIK)

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); // WAJIB AXIOS

const app = express();
const port = process.env.PORT || 3000;

// --- KONFIGURASI ENVIRONMENT VARIABLES (HARUS DIISI DI VERCEL!) ---
const JWT_SECRET = process.env.JWT_SECRET || 'KUNCI_RAHASIA_PANJANG_DAN_ACAK_SEKALI_GANTI_DI_VERCEL!';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY; // WAJIB ADA

// --- KONEKSI MONGODB ---
// Memastikan koneksi tidak dibungkus dalam app.listen (agar Vercel tidak crash)
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('MongoDB: KONEKSI OMEGA BERHASIL!'))
        .catch(err => {
            console.error('MongoDB: KONEKSI GAGAL TOTAL:', err.message);
            // Matikan proses jika gagal koneksi
            process.exit(1); 
        });
} else {
    console.error('MONGODB_URI: TIDAK DITEMUKAN! SERVER TIDAK AKAN JALAN!');
    process.exit(1);
}


// --- MODEL USER ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isPremium: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

app.use(express.json()); // WAJIB ADA
app.use(express.urlencoded({ extended: true }));


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
        // Jika gagal register (koneksi database), kembalikan error spesifik
        console.error("Register/Database Error:", error.message);
        res.status(500).json({ error: 'Gagal register. Cek koneksi database dan log server Vercel.' });
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
        console.error("Login Error:", error.message);
        res.status(500).json({ error: 'Gagal login. Cek log server Vercel!' });
    }
});

app.get('/api/auth/status', protect, (req, res) => {
    res.json({ status: 'success', isPremium: req.user.isPremium });
});


// --- ENDPOINT CHAT (LOGIKA SENSOR DENGAN AXIOS/REST API) ---
app.post('/api/chat', protect, async (req, res) => {
    const { prompt } = req.body;
    const mode = req.user.isPremium ? 'Premium' : 'Free'; 
    
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan." });
    }

    // Konfigurasi Safety Settings
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

    const requestBody = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { safetySettings: safetySettings }
    };

    try {
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            requestBody
        );
        
        // Cek apakah ada respons yang valid
        const responseText = geminiResponse.data.candidates 
                             ? geminiResponse.data.candidates[0].content.parts[0].text
                             : "Gagal mendapatkan respons AI.";

        res.json({ text: responseText });

    } catch (error) {
        console.error("Gemini API Error (Axios):", error.response ? error.response.data : error.message);
        res.status(500).json({ error: "Gagal memproses AI. Cek log server Vercel untuk error Axios." });
    }
});


// --- ENDPOINT MIDTRANS STATUS UPDATE (DUMMY/TO DO: IMPLEMENTASI SIGNATURE) ---
// Note: Perlu implementasi pengecekan signature Midtrans untuk security
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


// Export app untuk Vercel Serverless Function
module.exports = app;

// Server lokal (Hanya untuk testing lokal, Vercel akan mengabaikan ini)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server OMEGA berjalan di port ${port}`);
    });
}