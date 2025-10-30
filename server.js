// server.js - FULL CODE OMEGA AUTH & AI
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = process.env.PORT || 3000;

// --- KONEKSI MONGODB ---
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('MongoDB: KONEKSI OMEGA BERHASIL!'))
.catch(err => console.error('MongoDB: KONEKSI GAGAL TOTAL:', err));

// --- MODEL USER ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isPremium: { type: Boolean, default: false }, // Status Premium!
});
const User = mongoose.model('User', UserSchema);
// --- END MODEL ---

app.use(express.json());
app.use(express.static('public')); 

// --- OMEGA: SECRET KEY & MIDDLEWARE ---
const JWT_SECRET = process.env.JWT_SECRET || 'ganti_ini_dengan_kunci_sangat_rahasia_dan_panjang_di_vercel!';

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
        res.status(401).json({ error: 'Token tidak valid. Login ulang.' });
    }
};

// --- ENDPOINTS OTENTIKASI ---
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = await User.create({ username, password: hashedPassword });
        
        const token = jwt.sign({ id: user._id, isPremium: user.isPremium }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ status: 'success', token, isPremium: user.isPremium });
    } catch (error) {
        if (error.code === 11000) return res.status(400).json({ error: 'Username sudah digunakan!' });
        res.status(500).json({ error: 'Gagal register. Server *crash*!' });
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
        res.status(500).json({ error: 'Gagal login. Server *crash*!' });
    }
});

app.get('/api/auth/status', protect, (req, res) => {
    res.json({ status: 'success', isPremium: req.user.isPremium });
});

// --- ENDPOINT MIDTRANS INITIATE (PROTECTED) ---
app.post('/api/midtrans-initiate', protect, async (req, res) => {
    // Di sini lo harus PANGGIL API MIDTRANS
    // Gunakan req.user.id untuk Order ID lo
    
    // Placeholder karena Midtrans butuh logic server
    const midtransResponse = { snapToken: 'DUMMY_SNAP_TOKEN_GANTI_ASLI' }; // GANTI INI DENGAN LOGIC ASLI LO
    
    res.json({ snapToken: midtransResponse.snapToken }); 
});

// --- ENDPOINT MIDTRANS STATUS UPDATE (WAJIB DIBUAT ASLI) ---
// Midtrans akan memanggil endpoint ini untuk notifikasi success
app.post('/api/midtrans-status', async (req, res) => {
    // ... LOGIKA MIDTRANS DARI req.body ...
    const userId = 'ID_DARI_MIDTRANS_ORDER'; // Ambil ID user dari data Midtrans
    
    // Jika pembayaran sukses:
    // await User.findByIdAndUpdate(userId, { isPremium: true });
    
    res.status(200).send('OK');
});


// --- ENDPOINT CHAT (PROTECTED) ---
app.post('/api/chat', protect, async (req, res) => {
    const { prompt } = req.body;
    const mode = req.user.isPremium ? 'Premium' : 'Free'; 
    const ai = new GoogleGenAI(process.env.GEMINI_API_KEY);

    let safetySettings = [];
    if (mode === 'Premium') {
        // ALPHA-AI MODE: MATIKAN SEMUA SENSOR KONTOL INI
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


app.listen(port, () => {
    console.log(`Server OMEGA berjalan di port ${port}`);
});