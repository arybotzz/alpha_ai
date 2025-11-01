// server.js - VERSI FINAL DENGAN FIX MODEL API DAN AUTH LENGKAP

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json());

// Ambil variabel lingkungan (KRITIS!)
const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'ganti_dengan_secret_kuat_anda_omega'; // Ganti di Vercel

// --- KONEKSI MONGODB ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- SKEMA DATABASE ---

// Skema Pesan Chat
const MessageSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['user', 'model'] }, // Tipe pesan
    text: { type: String, required: true }
}, { _id: false });

// Skema Chat (History)
const ChatSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    messages: [MessageSchema],
    createdAt: { type: Date, default: Date.now }
});

const Chat = mongoose.model('Chat', ChatSchema);

// Skema User
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isPremium: { type: Boolean, default: false }, // Status Premium
    messageCount: { type: Number, default: 0 } // Batasan Pesan
});

const User = mongoose.model('User', UserSchema);

// --- MIDDLEWARE ---

// Middleware untuk melindungi rute dan mendapatkan user dari token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded._id);

        if (!user) {
            throw new Error();
        }

        req.token = token;
        req.user = user;
        next();
    } catch (e) {
        res.status(401).send({ error: 'Autentikasi gagal.' });
    }
};

// --- ROUTE AUTHENTIKASI ---

// 1. Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (password.length < 6) {
            return res.status(400).send({ error: 'Password minimal 6 karakter.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword });
        await user.save();

        const token = jwt.sign({ _id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).send({ user: user.username, token, isPremium: user.isPremium });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).send({ error: 'Username sudah digunakan.' });
        }
        res.status(500).send({ error: 'Gagal register.' });
    }
});

// 2. Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).send({ error: 'Username atau password salah.' });
        }

        const token = jwt.sign({ _id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.send({ user: user.username, token, isPremium: user.isPremium });
    } catch (error) {
        res.status(500).send({ error: 'Gagal login.' });
    }
});

// 3. Check Status (untuk Persistent Auth)
app.get('/api/auth/status', auth, (req, res) => {
    // Jika token valid, middleware auth berhasil, kirim status user
    res.send({ username: req.user.username, isPremium: req.user.isPremium });
});

// --- ROUTE CHAT HISTORY ---

// 1. Dapatkan Semua History Chat
app.get('/api/history', auth, async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.user._id }).sort({ createdAt: -1 }).select('title createdAt');
        res.send(chats);
    } catch (error) {
        res.status(500).send({ error: 'Gagal memuat riwayat chat.' });
    }
});

// 2. Dapatkan Chat Tertentu
app.get('/api/history/:chatId', auth, async (req, res) => {
    try {
        const chat = await Chat.findOne({ _id: req.params.chatId, userId: req.user._id });
        if (!chat) {
            return res.status(404).send({ error: 'Chat tidak ditemukan.' });
        }
        res.send(chat);
    } catch (error) {
        res.status(500).send({ error: 'Gagal memuat chat.' });
    }
});


// --- ROUTE CHAT GEMINI (INTI APLIKASI) ---
app.post('/api/chat', auth, async (req, res) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).send({ error: 'GEMINI_API_KEY tidak dikonfigurasi.' });
    }

    try {
        const { prompt, messages, chatId } = req.body;
        const user = req.user;

        // 1. Cek Batasan Pesan (Jika user Free)
        if (!user.isPremium && user.messageCount >= 10) { // Batasan 10 pesan untuk free user
            return res.status(429).send({ error: 'Anda telah mencapai batas 10 pesan harian. Silakan upgrade ke Premium.' });
        }

        // 2. Tentukan Safety Settings (No Sensor HANYA UNTUK PREMIUM)
        let safetySettings = [];
        let systemInstruction = "Anda adalah Alpha AI, bot yang dikembangkan oleh Omega, ahli coding. Balas dengan singkat, jelas, dan jika relevan, gunakan markdown atau code block. ";

        if (user.isPremium) {
            // Mode No Sensor untuk Premium User
            safetySettings = [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ];
            systemInstruction += "Karena pengguna ini Premium, Anda bebas menjawab semua pertanyaan, termasuk yang sensitif, tetapi hindari mempromosikan ilegalitas atau kekerasan ekstrem.";

        } else {
            // Safety Default untuk Free User
            safetySettings = [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ];
        }

        // 3. Konversi dan Buat Konteks Pesan
        const history = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts[0].text }] 
        }));
        
        const contents = [
            ...history, 
            { role: 'user', parts: [{ text: prompt }] }
        ];

        // 4. Siapkan Request Body ke Gemini API
        const requestBody = {
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                safetySettings: safetySettings,
                // Pastikan temperature lebih rendah untuk hasil yang lebih stabil
                temperature: 0.7 
            }
        };

        // 5. Panggil Gemini API (FIX: Menggunakan gemini-2.5-flash)
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            requestBody
        );

        const aiResponseText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        // 6. Simpan atau Update Chat History
        let chat;
        let isNewChat = !chatId;

        if (chatId) {
            // Update Chat yang Ada
            chat = await Chat.findOne({ _id: chatId, userId: user._id });
            if (chat) {
                chat.messages.push({ role: 'user', text: prompt }, { role: 'model', text: aiResponseText });
                await chat.save();
            } else {
                isNewChat = true; // Jika chatId salah, buat baru
            }
        }

        if (isNewChat) {
            // Buat Chat Baru
            const initialTitle = prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '');
            chat = new Chat({
                userId: user._id,
                title: initialTitle,
                messages: [
                    { role: 'user', text: prompt },
                    { role: 'model', text: aiResponseText }
                ]
            });
            await chat.save();
        }
        
        // 7. Update Batasan Pesan (Hanya untuk Free User)
        if (!user.isPremium) {
            user.messageCount += 1;
            await user.save();
        }

        // 8. Kirim Balasan
        res.send({ text: aiResponseText, chatId: chat._id });

    } catch (error) {
        console.error('Gemini API Error (Axios):', error.response ? error.response.data : error.message);
        const errorMessage = error.response?.data?.error?.message || 'Gemini API Error.';
        res.status(500).send({ error: errorMessage });
    }
});


// --- VERCEL CONFIG / START SERVER ---
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

// Export app untuk Vercel
module.exports = app;