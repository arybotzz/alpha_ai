// public/app.js - VERSI FINAL DENGAN FIX LOGIC LIMIT DAN STATUS MODE

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
    let currentMessageCount = 0; // Untuk menyimpan hitungan pesan user
    const FREE_LIMIT = 10; // Harus sama dengan di server.js

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

    const updateFooterDisclaimer = (isPremium, messageCount) => {
        if (!disclaimerText) return;
        
        if (isPremium) {
            disclaimerText.textContent = "Alpha AI: Mode Premium Aktif. Walaupun bebas, selalu verifikasi informasi sensitif.";
            disclaimerText.style.color = 'rgb(56, 189, 248)'; 
        } else {
            if (messageCount < FREE_LIMIT) {
                const remaining = FREE_LIMIT - messageCount;
                disclaimerText.textContent = `GPTfree: Mode NO SENSOR aktif. Sisa ${remaining} pesan harian.`;
                disclaimerText.style.color = '#38bdf8'; // Biru Muda untuk No Sensor
            } else {
                disclaimerText.textContent = `GPTfree: Mode SENSOR AKTIF (Limit No Sensor Habis: ${FREE_LIMIT}/${FREE_LIMIT}). Upgrade Premium.`;
                disclaimerText.style.color = '#ff6347'; // Merah untuk Sensor Aktif
            }
        }
    };
    
    const renderWelcomeMessage = (isPremium, messageCount) => {
        messagesContainer.innerHTML = ''; 
        
        let modelName, modeStatus;

        if (isPremium) {
            modelName = "Alpha AI";
            modeStatus = "Mode Premium No Sensor telah aktif. Tanyakan apapun, kodenya bersih!";
        } else {
             if (messageCount < FREE_LIMIT) {
                const remaining = FREE_LIMIT - messageCount;
                modelName = "GPTfree";
                modeStatus = `Mode No Sensor tersedia. Anda memiliki ${remaining} pesan tersisa hari ini.`;
            } else {
                modelName = "GPTfree";
                modeStatus = "Mode Sensor Standar aktif (Limit No Sensor Harian sudah habis).";
            }
        }

        const welcomeText = `**Selamat datang di ${modelName}!** ${modeStatus}`;

        renderMessage({ role: 'model', text: welcomeText });
    };


    const showChatInterface = (user, isPremium, messageCount, shouldRenderWelcome = true) => {
        authContainer.style.display = 'none'; 
        chatArea.style.display = 'flex'; 
        
        currentMessageCount = messageCount; // Set hitungan pesan
        
        const isNoSensorModeActive = isPremium || messageCount < FREE_LIMIT;

        if (modelTitle) {
            modelTitle.textContent = isNoSensorModeActive ? "Alpha AI" : "GPTfree (Sensor)";
        }
        
        if (userInfo) {
             userInfo.textContent = `Logged in as: ${user.username}`;
        }
        
        updateFooterDisclaimer(isPremium, messageCount); 

        // Logic Sidebar Mobile
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('open'); 
            headerMenuButton.style.display = 'block'; 
        } else {
            sidebar.classList.add('open'); 
            headerMenuButton.style.display = 'none'; 
        }
        
        sidebar.style.display = 'flex';
        
        premiumStatus.textContent = isPremium 
            ? 'Status: Premium (Full Power)' 
            : `Status: Free (${messageCount}/${FREE_LIMIT} No Sensor)`;
            
        loadChatHistory();

        if (shouldRenderWelcome) {
            renderWelcomeMessage(isPremium, messageCount);
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
        currentMessageCount = 0;
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
    
    // Fungsi loadChatHistory dan loadChat (Asumsi sama)
    // --- FUNGSI ASUMSI LOAD CHAT ---
    const loadChatHistory = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await axios.get('/api/history', {
                headers: { Authorization: `Bearer ${token}` }
            });

            historyList.innerHTML = '';
            response.data.forEach(chat => {
                const li = document.createElement('li');
                li.textContent = chat.title;
                if (chat._id === currentChatId) {
                    li.classList.add('active');
                }
                li.addEventListener('click', () => loadChat(chat._id));
                historyList.appendChild(li);
            });
        } catch (error) {
            console.error('Gagal memuat riwayat chat:', error);
            // Hanya log error, jangan ganggu user
        }
    };

    const loadChat = async (chatId) => {
        if (chatId === currentChatId) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await axios.get(`/api/history/${chatId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            currentChatId = chatId;
            currentMessages = response.data.messages.map(msg => ({ role: msg.role, text: msg.text }));
            messagesContainer.innerHTML = '';
            
            // Reload user status to ensure correct limit count
            const statusResponse = await axios.get('/api/auth/status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const { isPremium, messageCount } = statusResponse.data;
            currentMessageCount = messageCount;
            
            // Render messages
            currentMessages.forEach(renderMessage);
            
            // Update UI status
            const isNoSensorModeActive = isPremium || messageCount < FREE_LIMIT;
            modelTitle.textContent = isNoSensorModeActive ? "Alpha AI" : "GPTfree (Sensor)";
            updateFooterDisclaimer(isPremium, messageCount);
            premiumStatus.textContent = isPremium 
                ? 'Status: Premium (Full Power)' 
                : `Status: Free (${messageCount}/${FREE_LIMIT} No Sensor)`;

            // Highlight di sidebar
            Array.from(historyList.children).forEach(li => li.classList.remove('active'));
            const activeLi = Array.from(historyList.children).find(li => li.textContent === response.data.title);
            if (activeLi) activeLi.classList.add('active');
            
        } catch (error) {
            console.error('Gagal memuat chat:', error);
            alert('Gagal memuat chat.');
        }
    };
    // --- END FUNGSI ASUMSI LOAD CHAT ---

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
            const { username, isPremium, messageCount } = response.data;
            showChatInterface({ username }, isPremium, messageCount, true); 
        } catch (error) {
            console.error("Token tidak valid, silakan login ulang.");
            localStorage.removeItem('token');
            showAuthInterface(); 
        }
    };


    // --- EVENT LISTENERS ---
    
    headerMenuButton.addEventListener('click', () => sidebar.classList.toggle('open'));
    
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

        const chatContext = currentMessages.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));

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
            
            const { text: aiResponse, chatId: newChatId, limitWarning, messageCount, isNoSensorMode, isPremium } = response.data;

            currentChatId = newChatId;
            currentMessages = [...chatContext, { role: 'user', text: prompt }, { role: 'model', text: aiResponse }];
            
            // 🚨 KRITIS: Update status dan tampilkan peringatan 🚨
            currentMessageCount = messageCount;
            
            // Peringatan Limit
            if (limitWarning) {
                // Tampilkan peringatan limit
                renderMessage({ role: 'model', text: `🚨 **PERINGATAN!** ${limitWarning}` });
                // Mode otomatis beralih ke sensor
                modelTitle.textContent = "GPTfree (Sensor)";
            } else {
                // Mode sesuai status
                 modelTitle.textContent = isPremium || currentMessageCount < FREE_LIMIT ? "Alpha AI" : "GPTfree (Sensor)";
            }
            
            updateFooterDisclaimer(isPremium, currentMessageCount); 
            
            // Update sidebar status
            premiumStatus.textContent = isPremium 
                ? 'Status: Premium (Full Power)' 
                : `Status: Free (${currentMessageCount}/${FREE_LIMIT} No Sensor)`;


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

        // 🚨 PENAMBAHAN ALERT KRITIS 🚨
        const confirmed = confirm("ANDA HARUS MENGINGAT SANDI DAN USERNAME AKUN INI! Kami tidak menyimpan email atau fitur reset password. Apakah Anda ingin melanjutkan pendaftaran?");
        if (!confirmed) {
            return;
        }
        // 🚨 END PENAMBAHAN ALERT KRITIS 🚨

        try {
            const response = await axios.post('/api/auth/register', { username, password });
            localStorage.setItem('token', response.data.token);
            const { username: user, isPremium, messageCount } = response.data;
            showChatInterface({ username: user }, isPremium, messageCount, true); 
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
            const { username: user, isPremium, messageCount } = response.data;
            showChatInterface({ username: user }, isPremium, messageCount, true); 
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
                    const { isPremium, messageCount } = response.data;
                    const isNoSensorModeActive = isPremium || messageCount < FREE_LIMIT;
                    if (modelTitle) modelTitle.textContent = isNoSensorModeActive ? "Alpha AI" : "GPTfree (Sensor)";
                    updateFooterDisclaimer(isPremium, messageCount);
                    renderWelcomeMessage(isPremium, messageCount);
                    loadChatHistory(); 
                    currentMessageCount = messageCount;
                })
                .catch(() => {
                    if (modelTitle) modelTitle.textContent = "GPTfree (Sensor)";
                    updateFooterDisclaimer(false, FREE_LIMIT); 
                    renderWelcomeMessage(false, FREE_LIMIT);
                    loadChatHistory(); 
                    currentMessageCount = FREE_LIMIT;
                });
        } else {
             if (modelTitle) modelTitle.textContent = "GPTfree (Sensor)";
             updateFooterDisclaimer(false, FREE_LIMIT);
             renderWelcomeMessage(false, FREE_LIMIT);
             currentMessageCount = FREE_LIMIT;
        }
        
        Array.from(historyList.children).forEach(li => li.classList.remove('active'));
    });

    waButton.addEventListener('click', () => {
        const waNumber = '6285762008398';
        const message = encodeURIComponent("Halo Bro saya mau request update atau ada keluhan terkait Alpha AI.");
        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
    });

    upgradeButton.addEventListener('click', () => {
        alert('Fitur upgrade akan terhubung ke Midtrans.');
    });


    // Inisialisasi
    checkAuthStatus();
});