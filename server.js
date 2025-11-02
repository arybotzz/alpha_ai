// server.js - VERSI FINAL DENGAN FIX LOGIC LIMIT MODE FREE DAN SEMUA BUG API

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(express.json());

// KRITIS: Halaman ini menggunakan environment variable. Pastikan variabel ini diset di Vercel atau file .env lo.
const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'ganti_dengan_secret_kuat_anda_omega'; 

// --- KONEKSI MONGODB ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Connected!'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- SKEMA DATABASE ---

// Skema Pesan Chat
const MessageSchema = new mongoose.Schema({
    role: { type: String, required: true, enum: ['user', 'model'] }, 
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
    isPremium: { type: Boolean, default: false }, 
    messageCount: { type: Number, default: 0 },
    lastMessageDate: { type: Date, default: Date.now } // Untuk Reset Harian
});

const User = mongoose.model('User', UserSchema);

// Middleware
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
        
        // --- LOGIC RESET HARIAN ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Jika hari ini berbeda dengan lastMessageDate, reset hitungan
        if (user.lastMessageDate < today) {
            user.messageCount = 0;
            user.lastMessageDate = new Date(); // Update tanggal terakhir
            await user.save();
        }
        // --- END LOGIC RESET HARIAN ---

        next();
    } catch (e) {
        res.status(401).send({ error: 'Autentikasi gagal.' });
    }
};

// --- ROUTE AUTHENTIKASI & HISTORY ---
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
        res.status(201).send({ username: user.username, token, isPremium: user.isPremium, messageCount: user.messageCount });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).send({ error: 'Username sudah digunakan.' });
        }
        res.status(500).send({ error: 'Gagal register.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(400).send({ error: 'Username atau password salah.' });
        }

        const token = jwt.sign({ _id: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.send({ username: user.username, token, isPremium: user.isPremium, messageCount: user.messageCount });
    } catch (error) {
        res.status(500).send({ error: 'Gagal login.' });
    }
});

app.get('/api/auth/status', auth, (req, res) => {
    res.send({ username: req.user.username, isPremium: req.user.isPremium, messageCount: req.user.messageCount });
});

app.get('/api/history', auth, async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.user._id }).sort({ createdAt: -1 }).select('title createdAt');
        res.send(chats);
    } catch (error) {
        res.status(500).send({ error: 'Gagal memuat riwayat chat.' });
    }
});

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
        const FREE_LIMIT = 10; // KRITIS: Batas Pesan No Sensor

        // 1. Tentukan Status Mode (No Sensor vs Sensor Aktif)
        let isNoSensorMode = user.isPremium || user.messageCount < FREE_LIMIT;
        
        let safetySettings = [];
        let systemInstructionText = "Anda adalah Alpha AI, bot yang dikembangkan oleh Ryy_Xd Balas dengan singkat, jelas, dan jika relevan, gunakan markdown atau code block. ";

        if (user.isPremium) {
            // Premium: No Sensor, No Limit
            safetySettings = [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ];
            systemInstructionText += "Karena pengguna ini Premium, Anda bebas menjawab semua pertanyaan, termasuk yang sensitif, tetapi hindari mempromosikan ilegalitas atau kekerasan ekstrem.";
        } else if (isNoSensorMode) {
            // Free, Tapi Belum Habis Limit: No Sensor, Limited
            safetySettings = [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ];
            systemInstructionText += `Anda beroperasi dalam mode gratis NO SENSOR. Anda memiliki ${FREE_LIMIT - user.messageCount} pesan tersisa hari ini.`;
        } else {
            // Free, Limit Habis: Sensor Aktif, No Limit (tetap bisa chat, tapi disensor)
             safetySettings = [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
            ];
            systemInstructionText += "Anda beroperasi dalam mode gratis SENSOR AKTIF (Limit No Sensor Harian sudah habis). Jaga balasan tetap aman dan etis. Untuk No Sensor, silakan upgrade.";
        }

        // 3. Konversi dan Buat Konteks Pesan
        const contents = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.parts[0].text }] 
        }));
        
        let finalPrompt = prompt;

        // FIX MUTLAK V10: Gabungkan System Instruction ke prompt pertama jika chat baru
        if (contents.length === 0) {
            finalPrompt = `[SYSTEM INSTRUCTION: ${systemInstructionText}] [USER PROMPT: ${prompt}]`;
        }
        
        contents.push({ role: 'user', parts: [{ text: finalPrompt }] });


        // 4. Siapkan Request Body ke Gemini API
        const requestBody = {
            contents: contents, 
            generationConfig: {
                temperature: 0.7 
            },
            safetySettings: safetySettings 
        };

        // 5. Panggil Gemini API (Dengan Validasi)
        const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            requestBody
        );

        // VALIDASI KRITIS RESPONS
        if (!geminiResponse.data.candidates || geminiResponse.data.candidates.length === 0) {
            const rejectionReason = geminiResponse.data.promptFeedback?.blockReason || 'Tidak Diketahui';
            return res.status(500).send({ 
                error: `Respons API Kosong. Pesan Anda mungkin diblokir oleh Safety Filter Gemini. Alasan: ${rejectionReason}. Coba prompt lain atau periksa API Key Anda.` 
            });
        }

        const aiResponseText = geminiResponse.data.candidates[0].content.parts[0].text;
        
        // 6. Simpan atau Update Chat History
        let chat;
        let isNewChat = !chatId;

        const promptToSave = prompt; 
        const chatMessagesToSave = [
            { role: 'user', text: promptToSave },
            { role: 'model', text: aiResponseText }
        ];

        if (chatId) {
            chat = await Chat.findOne({ _id: chatId, userId: user._id });
            if (chat) {
                chat.messages.push(...chatMessagesToSave);
                await chat.save();
            } else {
                isNewChat = true; 
            }
        }

        if (isNewChat) {
            const initialTitle = prompt.substring(0, 30) + (prompt.length > 30 ? '...' : '');
            chat = new Chat({
                userId: user._id,
                title: initialTitle,
                messages: chatMessagesToSave
            });
            await chat.save();
        }
        
        // 7. Update Batasan Pesan
        let updatedMessageCount = user.messageCount;
        let limitWarning = null;
        
        if (!user.isPremium) {
            if (user.messageCount < FREE_LIMIT) {
                updatedMessageCount += 1;
                user.messageCount = updatedMessageCount;
                user.lastMessageDate = new Date(); 
                await user.save();
                
                // Cek jika hitungan BARU mencapai limit
                if (updatedMessageCount === FREE_LIMIT) {
                     // *** PESAN FINAL SESUAI PERMINTAAN USER ***
                     limitWarning = `LIMIT ANDA DI MODE NO SENSOR TELAH HABIS (${FREE_LIMIT}/${FREE_LIMIT}). Chat Anda selanjutnya akan menggunakan mode sensor standar. Silakan berlangganan Premium untuk melanjutkan akses chat bebas.`;
                }
            } 
        }

        // 8. Kirim Balasan (sertakan limitWarning jika ada)
        res.send({ 
            text: aiResponseText, 
            chatId: chat._id,
            limitWarning: limitWarning, 
            messageCount: updatedMessageCount,
            // Status mode untuk frontend (cek jika mode no sensor masih aktif)
            isNoSensorMode: isNoSensorMode && updatedMessageCount < FREE_LIMIT 
        });

    } catch (error) {
        console.error('Gemini API Error (Axios):', error.response ? error.response.data : error.message);
        const errorMessage = error.response?.data?.error?.message || 'Gemini API Error. Periksa logs, API Key, atau format pesan.';
        res.status(500).send({ error: errorMessage });
    }
});


// --- VERCEL CONFIG / START SERVER ---
app.use(express.static('public')); 

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}

// Export app untuk Vercel
module.exports = app;