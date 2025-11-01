// server.js - VERSI FINAL DENGAN HISTORY CHAT DAN PAYLOAD FIX

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios'); 

const app = express();
const port = process.env.PORT || 3000;

// --- KONFIGURASI ENVIRONMENT VARIABLES (HARUS DIISI DI VERCEL!) ---
const JWT_SECRET = process.env.JWT_SECRET || 'KUNCI_RAHASIA_PANJANG_DAN_ACAK_SEKALI_GANTI_DI_VERCEL!';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MONGODB_URI = process.env.MONGODB_URI;
const MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY; 

// --- KONEKSI MONGODB ---
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('MongoDB: KONEKSI OMEGA BERHASIL!'))
        .catch(err => {
            console.error('MongoDB: KONEKSI GAGAL TOTAL:', err.message);
            process.exit(1); 
        });
} else {
    console.error('MONGODB_URI: TIDAK DITEMUKAN! SERVER TIDAK AKAN JALAN!');
    process.exit(1);
}


// --- MODELS ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isPremium: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

const ChatHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    messages: [{
        role: { type: String, enum: ['user', 'model'], required: true },
        text: { type: String, required: true }
    }],
    createdAt: { type: Date, default: Date.now }
});
const ChatHistory = mongoose.model('ChatHistory', ChatHistorySchema);


app.use(express.json()); 
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


// --- ENDPOINTS OTENTIKASI & STATUS ---
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


// --- ENDPOINT RIWAYAT CHAT (BARU) ---
app.get('/api/history', protect, async (req, res) => {
    try {
        // Ambil riwayat chat (hanya ID, Judul, dan Waktu)
        const history = await ChatHistory.find({ userId: req.user.id })
            .select('_id title createdAt')
            .sort({ createdAt: -1 })
            .limit(20); // Batasi 20 chat terakhir

        res.json(history);
    } catch (error) {
        console.error("History Fetch Error:", error.message);
        res.status(500).json({ error: 'Gagal memuat riwayat chat.' });
    }
});

app.get('/api/history/:chatId', protect, async (req, res) => {
    try {
        const chat = await ChatHistory.findOne({ _id: req.params.chatId, userId: req.user.id });
        if (!chat) {
            return res.status(404).json({ error: 'Chat tidak ditemukan.' });
        }
        res.json(chat);
    } catch (error) {
        console.error("Single Chat Fetch Error:", error.message);
        res.status(500).json({ error: 'Gagal memuat chat.' });
    }
});


// --- ENDPOINT CHAT (PAYLOAD FIX FINAL) ---
app.post('/api/chat', protect, async (req, res) => {
    const { prompt, messages, chatId } = req.body; // Terima pesan dan chatId yang sudah ada
    const userId = req.user.id;
    const mode = req.user.isPremium ? 'Premium' : 'Free'; 
    
    if (!GEMINI_API_KEY) {
        return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan." });
    }

    // 1. Definisikan Safety Settings
    let safetySettings = [];
    if (mode === 'Premium') {
        safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ];
    } 

    // 2. Susun Payload (GEMINI PRO FIX)
    // Gunakan 'messages' yang diterima dari frontend (riwayat chat)
    // NOTE: Gemini API (v1beta) ingin role 'user' dan 'model' bergantian.
    const contents = [...(messages || []), { role: "user", parts: [{ text: prompt }] }];
    
    // FIX FINAL: Kami kirim safetySettings DI LUAR CONFIG dan menggunakan gemini-pro untuk kestabilan payload ini
    const requestBody = {
        contents: contents, 
    };

    // Tambahkan safetySettings jika ada
    if (safetySettings.length > 0) {
        requestBody.safetySettings = safetySettings;
    }


    try {
        // Menggunakan gemini-pro untuk kestabilan v1beta
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
            requestBody
        );
        
        const responseText = geminiResponse.data.candidates 
                             ? geminiResponse.data.candidates[0].content.parts[0].text
                             : "Gagal mendapatkan respons AI.";

        // --- SIMPAN RIWAYAT ---
        let chat;
        const userMessage = { role: 'user', text: prompt };
        const modelMessage = { role: 'model', text: responseText };

        if (chatId) {
            // Perbarui chat yang sudah ada
            chat = await ChatHistory.findByIdAndUpdate(chatId, {
                $push: { messages: { $each: [userMessage, modelMessage] } }
            }, { new: true });
        } else {
            // Buat chat baru dengan judul dari 15 karakter prompt pertama
            const title = prompt.substring(0, 15) + (prompt.length > 15 ? '...' : '');
            chat = await ChatHistory.create({
                userId: userId,
                title: title,
                messages: [userMessage, modelMessage]
            });
        }
        // --- END SIMPAN RIWAYAT ---

        res.json({ text: responseText, chatId: chat._id });

    } catch (error) {
        console.error("Gemini API Error (Axios):", error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
        res.status(500).json({ error: "Gagal memproses AI. Cek log server Vercel untuk error Axios." });
    }
});


// --- ENDPOINT MIDTRANS NOTIFIKASI ---
app.post('/api/midtrans-status', async (req, res) => {
    try {
        const notification = req.body;
        const transactionStatus = notification.transaction_status;
        const orderId = notification.order_id; 
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

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`Server OMEGA berjalan di port ${port}`);
    });
}