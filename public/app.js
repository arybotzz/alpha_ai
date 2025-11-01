// app.js - VERSI FINAL DENGAN HISTORY, COPY CODE, DAN WA BUTTON

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chat-container');
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const authContainer = document.getElementById('auth-container');
    const chatInterface = document.getElementById('chat-interface');
    const messageForm = document.getElementById('message-form');
    const messageInput = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages-container');
    const sidebar = document.getElementById('sidebar');
    const historyList = document.getElementById('history-list');
    const premiumStatus = document.getElementById('premium-status');
    const logoutButton = document.getElementById('logout-button');
    const upgradeButton = document.getElementById('upgrade-button');
    const newChatButton = document.getElementById('new-chat-button');
    const waButton = document.getElementById('wa-button');
    
    // Status Chat
    let currentChatId = null;
    let currentMessages = []; // Digunakan untuk menyimpan konteks chat

    // --- MARKDOWN & CODE COPY LIBRARY ---
    // Pastikan <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    // dan <script src="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/js/all.min.js"></script>
    // sudah ada di HTML lo.
    const { marked } = window;
    
    // Fungsi untuk menyalin teks
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Kode berhasil disalin!');
        }).catch(err => {
            console.error('Gagal menyalin:', err);
            alert('Gagal menyalin. Silakan coba manual.');
        });
    };

    // Fungsi untuk me-render pesan
    const renderMessage = (message) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${message.role}-message`);
        
        // Render Markdown 
        let htmlContent = marked.parse(message.text || '');

        // Cari dan bungkus code blocks dengan div khusus untuk tombol copy
        htmlContent = htmlContent.replace(/<pre><code(.*?)>([\s\S]*?)<\/code><\/pre>/g, (match, p1, p2) => {
            // Decode HTML entities
            const codeContent = p2.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            return `
                <div class="code-block-wrapper">
                    <button class="copy-button" data-code="${encodeURIComponent(codeContent)}">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <pre><code${p1}>${p2}</code></pre>
                </div>
            `;
        });
        
        messageElement.innerHTML = htmlContent;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // Event listener untuk tombol copy
    messagesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-button')) {
            const codeContent = decodeURIComponent(e.target.dataset.code);
            copyToClipboard(codeContent);
        }
    });

    // Fungsi untuk menampilkan interface chat dan sidebar
    const showChatInterface = (isPremium) => {
        authContainer.style.display = 'none';
        chatInterface.style.display = 'flex';
        premiumStatus.textContent = isPremium ? 'Status: Premium (Full Power)' : 'Status: Free (Limitasi Aktif)';
        loadChatHistory();
    };

    // Fungsi untuk memuat riwayat chat dari server
    const loadChatHistory = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await axios.get('/api/history', {
                headers: { Authorization: `Bearer ${token}` }
            });

            historyList.innerHTML = ''; // Kosongkan daftar
            response.data.forEach(chat => {
                const listItem = document.createElement('li');
                listItem.textContent = chat.title;
                listItem.dataset.chatId = chat._id;
                listItem.addEventListener('click', () => loadChat(chat._id));
                historyList.appendChild(listItem);
            });

        } catch (error) {
            console.error("Gagal memuat riwayat:", error);
        }
    };

    // Fungsi untuk memuat chat tertentu
    const loadChat = async (chatId) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await axios.get(`/api/history/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const chat = response.data;
            currentChatId = chat._id;
            
            // Format ulang pesan untuk konteks Gemini
            currentMessages = chat.messages.map(msg => ({ 
                role: msg.role === 'user' ? 'user' : 'model', 
                parts: [{ text: msg.text }] 
            }));

            messagesContainer.innerHTML = '';
            chat.messages.forEach(msg => renderMessage(msg));
            
            // Tandai chat yang sedang aktif di sidebar
            Array.from(historyList.children).forEach(li => {
                li.classList.toggle('active', li.dataset.chatId === chatId);
            });

        } catch (error) {
            alert('Gagal memuat chat: ' + error.response?.data?.error || error.message);
        }
    };

    // Cek status login saat memuat halaman (Persisten Auth)
    const checkAuthStatus = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            chatInterface.style.display = 'none';
            authContainer.style.display = 'flex';
            return;
        }

        try {
            const response = await axios.get('/api/auth/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            showChatInterface(response.data.isPremium);
        } catch (error) {
            console.error("Token tidak valid, silakan login ulang.");
            localStorage.removeItem('token');
            chatInterface.style.display = 'none';
            authContainer.style.display = 'flex';
        }
    };

    // --- SUBMIT MESSAGE ---
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = messageInput.value.trim();
        if (!prompt) return;

        messageInput.value = ''; // Kosongkan input
        
        // Tampilkan pesan user
        renderMessage({ role: 'user', text: prompt });

        const token = localStorage.getItem('token');
        if (!token) {
            renderMessage({ role: 'model', text: 'Sesi berakhir, silakan login ulang.' });
            return;
        }

        // Susun riwayat chat untuk dikirim ke server (konteks)
        const chatContext = currentMessages.map(msg => ({ role: msg.role, parts: msg.parts }));

        try {
            // Tampilkan loading indicator
            renderMessage({ role: 'model', text: '...' }); 
            const loadingElement = messagesContainer.lastElementChild;
            
            const response = await axios.post('/api/chat', { 
                prompt: prompt,
                messages: chatContext,
                chatId: currentChatId 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Hapus loading indicator
            messagesContainer.removeChild(loadingElement);
            
            const aiResponse = response.data.text;
            const newChatId = response.data.chatId;

            // Simpan konteks lokal untuk chat selanjutnya
            currentChatId = newChatId;
            currentMessages = [...chatContext, { role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: aiResponse }] }];

            // Tampilkan respons AI
            renderMessage({ role: 'model', text: aiResponse });

            // Muat ulang history setelah chat baru/update
            loadChatHistory();


        } catch (error) {
            messagesContainer.removeChild(messagesContainer.lastElementChild); // Hapus loading
            renderMessage({ role: 'model', text: '❌ Error: ' + error.response?.data?.error || 'Koneksi gagal.' });
            console.error(error);
        }
    });
    
    // --- AUTH LISTENERS ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const response = await axios.post('/api/auth/register', { username, password });
            localStorage.setItem('token', response.data.token);
            showChatInterface(response.data.isPremium);
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal register');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target.username.value;
        const password = e.target.password.value;

        try {
            const response = await axios.post('/api/auth/login', { username, password });
            localStorage.setItem('token', response.data.token);
            showChatInterface(response.data.isPremium);
        } catch (error) {
            alert(error.response?.data?.error || 'Login gagal. Cek username/password.');
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.reload();
    });

    // --- FITUR BARU LISTENERS ---
    newChatButton.addEventListener('click', () => {
        currentChatId = null;
        currentMessages = [];
        messagesContainer.innerHTML = '';
        messageInput.value = '';
        Array.from(historyList.children).forEach(li => li.classList.remove('active'));
    });

    // Tombol WhatsApp
    waButton.addEventListener('click', () => {
        const waNumber = '6285762008398';
        const message = encodeURIComponent("Halo Omega, saya mau request update atau ada keluhan terkait Alpha AI.");
        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
    });

    // Tombol Upgrade (Contoh Midtrans)
    upgradeButton.addEventListener('click', () => {
        alert('Fitur upgrade akan terhubung ke Midtrans.');
        // LOGIKA MIDTRANS LO HARUSNYA DI SINI
    });


    // Inisialisasi
    checkAuthStatus();
});