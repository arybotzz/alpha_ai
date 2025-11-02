// public/app.js - VERSI FINAL DENGAN FIX LENGKAP

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMEN HTML ---
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const authContainer = document.getElementById('auth-container');
    const chatInterface = document.getElementById('chat-interface');
    const messageForm = document.getElementById('message-form');
    const messagesContainer = document.getElementById('messages-container');
    const sidebar = document.getElementById('sidebar');
    const historyList = document.getElementById('history-list');
    const premiumStatus = document.getElementById('premium-status');
    const logoutButton = document.getElementById('logout-button');
    const upgradeButton = document.getElementById('upgrade-button');
    const newChatButton = document.getElementById('new-chat-button');
    const waButton = document.getElementById('wa-button');
    const chatArea = document.getElementById('chat-area');
    const messageInput = document.getElementById('message-input');
    
    // Elemen Header dan Footer KRITIS
    const modelTitle = document.getElementById('model-title'); 
    const disclaimerText = document.getElementById('disclaimer-text'); 
    const userInfo = document.getElementById('user-info'); 

    // Tombol Mobile
    const headerMenuButton = document.getElementById('header-menu-button');
    
    // Status Chat
    let currentChatId = null;
    let currentMessages = []; 

    // --- LIBRARY MARKDOWN ---
    const { marked } = window;
    
    // --- FUNGSI UTILITY ---
    
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Kode berhasil disalin!');
        }).catch(err => {
            console.error('Gagal menyalin:', err);
            alert('Gagal menyalin. Silakan coba manual.');
        });
    };

    const renderMessage = (message) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${message.role}-message`);
        
        let htmlContent = marked.parse(message.text || '');

        htmlContent = htmlContent.replace(/<pre><code(.*?)>([\s\S]*?)<\/code><\/pre>/g, (match, p1, p2) => {
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

    // --- FUNGSI INTERFACE ---

    const updateFooterDisclaimer = (isPremium) => {
        if (!disclaimerText) return;
        
        if (isPremium) {
            disclaimerText.textContent = "Alpha AI: Mode Premium Aktif. Walaupun bebas, selalu verifikasi informasi sensitif.";
            disclaimerText.style.color = 'rgb(56, 189, 248)'; 
        } else {
            disclaimerText.textContent = "GPTfree dapat melakukan kesalahan. Periksa ulang fakta penting. Batasan pesan aktif.";
            disclaimerText.style.color = '#ff6347'; 
        }
    };
    
    const renderWelcomeMessage = (isPremium) => {
        messagesContainer.innerHTML = ''; 
        const modelName = isPremium ? "Alpha AI" : "GPTfree";
        const mode = isPremium 
            ? "Mode No Sensor telah aktif. Tanyakan apapun, kodenya bersih!"
            : "Anda menggunakan versi gratis (Safety Default Aktif).";

        const welcomeText = `**Selamat datang di ${modelName}!** ${mode}`;

        renderMessage({ role: 'model', text: welcomeText });
    };


    const showChatInterface = (user, isPremium, shouldRenderWelcome = true) => {
        authContainer.style.display = 'none'; 
        chatArea.style.display = 'flex'; 
        
        if (modelTitle) {
            modelTitle.textContent = isPremium ? "Alpha AI" : "GPTfree";
        }
        
        if (userInfo) {
             userInfo.textContent = `Logged in as: ${user.username}`;
        }
        
        updateFooterDisclaimer(isPremium); 

        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open'); 
            headerMenuButton.style.display = 'block'; 
        } else {
            sidebar.classList.add('open'); 
            headerMenuButton.style.display = 'none'; 
        }
        
        sidebar.style.display = 'flex';
        
        premiumStatus.textContent = isPremium ? 'Status: Premium (Full Power)' : 'Status: Free (Limitasi Aktif)';
        loadChatHistory();

        if (shouldRenderWelcome) {
            renderWelcomeMessage(isPremium);
        }
    };

    const showAuthInterface = () => {
        authContainer.style.display = 'flex'; 
        chatArea.style.display = 'none';
        sidebar.style.display = 'none';
        sidebar.classList.remove('open'); 
        currentChatId = null;
        currentMessages = [];
        messagesContainer.innerHTML = ''; 
        if (modelTitle) {
            modelTitle.textContent = "AI Chat";
        }
        if (disclaimerText) {
            disclaimerText.textContent = ""; 
        }
        if (userInfo) {
             userInfo.textContent = 'Logged in as: N/A';
        }
    };
    
    const toggleSidebar = () => {
        sidebar.classList.toggle('open');
    };
    

    // --- FUNGSI DATA ---

    const loadChatHistory = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await axios.get('/api/history', {
                headers: { Authorization: `Bearer ${token}` }
            });

            historyList.innerHTML = ''; 
            response.data.forEach(chat => {
                const listItem = document.createElement('li');
                listItem.textContent = chat.title;
                listItem.dataset.chatId = chat._id;
                listItem.addEventListener('click', () => {
                    loadChat(chat._id);
                    if (window.innerWidth <= 768) {
                        sidebar.classList.remove('open'); 
                    }
                });
                historyList.appendChild(listItem);
            });

        } catch (error) {
            console.error("Gagal memuat riwayat:", error);
        }
    };

    const loadChat = async (chatId) => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await axios.get(`/api/history/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const chat = response.data;
            currentChatId = chat._id;
            
            // Konversi format pesan dari database ke format yang digunakan untuk konteks
            currentMessages = chat.messages.map(msg => ({ 
                role: msg.role === 'user' ? 'user' : 'model', 
                parts: [{ text: msg.text }] 
            }));

            messagesContainer.innerHTML = '';
            // Render pesan menggunakan format database {role, text}
            chat.messages.forEach(msg => renderMessage(msg));
            
            Array.from(historyList.children).forEach(li => {
                li.classList.toggle('active', li.dataset.chatId === chatId);
            });

        } catch (error) {
            alert('Gagal memuat chat: ' + error.response?.data?.error || error.message);
        }
    };

    const checkAuthStatus = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showAuthInterface(); 
            return;
        }

        try {
            const response = await axios.get('/api/auth/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            showChatInterface(response.data, response.data.isPremium, false); 
        } catch (error) {
            console.error("Token tidak valid, silakan login ulang.");
            localStorage.removeItem('token');
            showAuthInterface(); 
        }
    };


    // --- EVENT LISTENERS ---
    
    headerMenuButton.addEventListener('click', toggleSidebar);
    
    messagesContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('copy-button')) {
            const codeContent = decodeURIComponent(e.target.dataset.code);
            copyToClipboard(codeContent);
        }
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
        }
    });
    
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768) {
            sidebar.classList.add('open');
            headerMenuButton.style.display = 'none';
        } else {
            if (!sidebar.classList.contains('open')) {
                 headerMenuButton.style.display = 'block'; 
            }
        }
    });
    
    // 2. Chat Submit 
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = messageInput.value.trim();
        if (!prompt) return;

        messageInput.value = ''; 
        
        renderMessage({ role: 'user', text: prompt });

        const token = localStorage.getItem('token');
        if (!token) {
            renderMessage({ role: 'model', text: 'Sesi berakhir, silakan login ulang.' });
            return;
        }

        // Ambil konteks pesan yang ada
        const chatContext = currentMessages.map(msg => ({ role: msg.role, parts: msg.parts }));

        try {
            renderMessage({ role: 'model', text: '...' }); 
            const loadingElement = messagesContainer.lastElementChild;
            
            const response = await axios.post('/api/chat', { 
                prompt: prompt,
                messages: chatContext,
                chatId: currentChatId 
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            messagesContainer.removeChild(loadingElement);
            
            const aiResponse = response.data.text;
            const newChatId = response.data.chatId;

            currentChatId = newChatId;
            currentMessages = [...chatContext, { role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: aiResponse }] }];

            renderMessage({ role: 'model', text: aiResponse });

            loadChatHistory(); 

        } catch (error) {
            messagesContainer.removeChild(messagesContainer.lastElementChild); 
            renderMessage({ role: 'model', text: '❌ Error: ' + error.response?.data?.error || 'Koneksi gagal.' });
            console.error(error);
        }
    });
    
    // 3. AUTH LISTENERS 
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target['register-username'].value;
        const password = e.target['register-password'].value;

        try {
            const response = await axios.post('/api/auth/register', { username, password });
            localStorage.setItem('token', response.data.token);
            showChatInterface(response.data, response.data.isPremium, true); 
        } catch (error) {
            alert(error.response?.data?.error || 'Gagal register');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = e.target['login-username'].value;
        const password = e.target['login-password'].value;

        try {
            const response = await axios.post('/api/auth/login', { username, password });
            localStorage.setItem('token', response.data.token);
            showChatInterface(response.data, response.data.isPremium, true); 
        } catch (error) {
            alert(error.response?.data?.error || 'Login gagal. Cek username/password.');
        }
    });
    
    document.getElementById('switch-auth').addEventListener('click', () => {
        const isLogin = loginForm.classList.contains('hidden');
        document.getElementById('auth-title').textContent = isLogin ? 'LOGIN' : 'REGISTER';
        loginForm.classList.toggle('hidden');
        registerForm.classList.toggle('hidden');
        document.getElementById('switch-auth').textContent = isLogin ? 'Belum punya akun? Register!' : 'Sudah punya akun? Login!';
    });

    logoutButton.addEventListener('click', () => {
        const isConfirmed = confirm('Apakah Anda yakin ingin keluar dari sesi Alpha AI?');
        if (isConfirmed) {
            localStorage.removeItem('token');
            showAuthInterface(); 
        }
    });

    // 4. FITUR TAMBAHAN (New Chat FIX)
    newChatButton.addEventListener('click', () => {
        currentChatId = null;
        currentMessages = [];
        messagesContainer.innerHTML = '';
        messageInput.value = '';
        
        const token = localStorage.getItem('token');
        if (token) {
             axios.get('/api/auth/status', { headers: { Authorization: `Bearer ${token}` } })
                .then(response => {
                    const isPremium = response.data.isPremium;
                    if (modelTitle) modelTitle.textContent = isPremium ? "Alpha AI" : "GPTfree";
                    updateFooterDisclaimer(isPremium);
                    renderWelcomeMessage(isPremium);
                    loadChatHistory(); 
                })
                .catch(() => {
                    if (modelTitle) modelTitle.textContent = "GPTfree";
                    updateFooterDisclaimer(false);
                    renderWelcomeMessage(false);
                    loadChatHistory(); 
                });
        } else {
             if (modelTitle) modelTitle.textContent = "GPTfree";
             updateFooterDisclaimer(false);
             renderWelcomeMessage(false);
        }
        
        Array.from(historyList.children).forEach(li => li.classList.remove('active'));
    });

    waButton.addEventListener('click', () => {
        const waNumber = '6285762008398';
        const message = encodeURIComponent("Halo saya mau request update atau ada keluhan terkait Alpha AI.");
        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
    });

    upgradeButton.addEventListener('click', () => {
        alert('Fitur upgrade akan terhubung ke Midtrans.');
    });


    // Inisialisasi
    checkAuthStatus();
});