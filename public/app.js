// public/app.js - VERSI FINAL MUTLAK & SERVER-SIDE ALIGNED

document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMEN HTML ---
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    const authContainer = document.getElementById('auth-container');
    const messagesContainer = document.getElementById('messages-container');
    const sidebar = document.getElementById('sidebar');
    const historyList = document.getElementById('history-list');
    const premiumStatus = document.getElementById('premium-status');
    const logoutButton = document.getElementById('logout-button');
    const newChatButton = document.getElementById('new-chat-button');
    const waButton = document.getElementById('wa-button');
    const upgradeButton = document.getElementById('upgrade-button');
    const chatArea = document.getElementById('chat-area');
    const messageForm = document.getElementById('message-form');
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
    let currentMessageCount = 0; 
    const FREE_LIMIT = 10; 
    const MIN_LENGTH = 6; 

    // --- LIBRARY MARKDOWN ---
    const { marked } = window;
    
    // --- FUNGSI UTILITY ---
    
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert("Kode berhasil disalin!");
        }).catch(err => {
            console.error('Gagal menyalin:', err);
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
                disclaimerText.style.color = '#38bdf8'; 
            } else {
                disclaimerText.textContent = `GPTfree: Mode SENSOR AKTIF (Limit No Sensor Habis: ${FREE_LIMIT}/${FREE_LIMIT}). Upgrade Premium.`;
                disclaimerText.style.color = '#ff6347'; 
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
                modelName = "GPTfree (Sensor)";
                modeStatus = "Mode Sensor Standar aktif (Limit No Sensor Harian sudah habis).";
            }
        }

        const isNoSensorModeActive = isPremium || messageCount < FREE_LIMIT;
        if (modelTitle) {
            modelTitle.textContent = isNoSensorModeActive ? "Alpha AI" : "GPTfree (Sensor)";
        }

        const welcomeText = `**Selamat datang di ${modelName}!** ${modeStatus}`;

        renderMessage({ role: 'model', text: welcomeText });
    };


    const showChatInterface = (user, isPremium, messageCount, shouldRenderWelcome = true) => {
        authContainer.style.display = 'none'; 
        chatArea.style.display = 'flex'; 
        
        currentMessageCount = messageCount; 
        
        const isNoSensorModeActive = isPremium || messageCount < FREE_LIMIT;

        if (modelTitle) {
            modelTitle.textContent = isNoSensorModeActive ? "Alpha AI" : "GPTfree (Sensor)";
        }
        
        if (userInfo) {
            // Menggunakan email
            userInfo.textContent = `Logged in as: ${user.email || 'N/A'}`; 
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
            
        loadChatHistory(); // Placeholder

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
    
    // --- FUNGSI ASUMSI LOAD CHAT (PLACEHOLDER) ---
    const loadChatHistory = async () => {
        console.warn("loadChatHistory: Endpoint /api/history belum diimplementasikan di server.");
        historyList.innerHTML = '<li class="text-gray-400">Riwayat Chat (Fitur Belum Aktif)</li>';
    };

    const loadChat = async (chatId) => {
        console.warn("loadChat: Endpoint /api/history/:id belum diimplementasikan di server.");
    };
    // --- END FUNGSI ASUMSI LOAD CHAT ---

    const checkAuthStatus = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            showAuthInterface(); 
            return;
        }

        try {
            // ENDPOINT ALIGNED: /user/me
            const response = await axios.get('/user/me', { 
                headers: { Authorization: `Bearer ${token}` }
            });
            
            // Mengambil 'email'
            const { email, isPremium, chatCount } = response.data.user; 
            
            // Auto-Login sukses
            showChatInterface({ email }, isPremium, chatCount, true); 
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
        
        // Buat elemen chat untuk response streaming
        const tempMessageElement = document.createElement('div');
        tempMessageElement.classList.add('message', 'model-message', 'loading-stream');
        messagesContainer.appendChild(tempMessageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        renderMessage({ role: 'user', text: prompt });

        const token = localStorage.getItem('token');
        if (!token) {
            renderMessage({ role: 'model', text: 'Sesi berakhir, silakan login ulang.' });
            return;
        }

        // Tambahkan pesan user saat ini ke context
        currentMessages.push({ role: 'user', text: prompt });

        // Ubah format history agar sesuai dengan body server
        const chatContext = currentMessages.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));

        try {
            const isNoSensorModeActive = currentMessageCount < FREE_LIMIT || premiumStatus.textContent.includes('Premium');

            const response = await fetch('/chat', { // ENDPOINT ALIGNED: /chat
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: prompt,
                    history: chatContext.slice(0, -1),
                    blockNone: isNoSensorModeActive 
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP error! status: ${response.status}`);
            }

            // Hapus elemen loading/streaming placeholder
            messagesContainer.removeChild(tempMessageElement); 

            // Proses Streaming Response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponseText = '';
            
            // Buat elemen baru untuk menampung seluruh respons AI
            const finalMessageElement = document.createElement('div');
            finalMessageElement.classList.add('message', 'model-message');
            messagesContainer.appendChild(finalMessageElement);
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                fullResponseText += chunk;
                
                // Render secara bertahap
                finalMessageElement.innerHTML = marked.parse(fullResponseText);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            // Simpan respons penuh ke currentMessages
            currentMessages.push({ role: 'model', text: fullResponseText }); 

            // Cek status terbaru user untuk update counter/status
            const statusUpdate = await axios.get('/user/me', { headers: { Authorization: `Bearer ${token}` } }); // ENDPOINT ALIGNED: /user/me
            const { isPremium, chatCount } = statusUpdate.data.user;
            
            currentMessageCount = chatCount;
            
            const isNoSensorModeActiveAfterChat = isPremium || currentMessageCount < FREE_LIMIT;
            modelTitle.textContent = isNoSensorModeActiveAfterChat ? "Alpha AI" : "GPTfree (Sensor)";

            updateFooterDisclaimer(isPremium, currentMessageCount); 
            
            premiumStatus.textContent = isPremium 
                ? 'Status: Premium (Full Power)' 
                : `Status: Free (${currentMessageCount}/${FREE_LIMIT} No Sensor)`;

        } catch (error) {
            currentMessages.pop(); 
            
            const lastElement = messagesContainer.lastElementChild;
            if (lastElement && lastElement.classList.contains('model-message')) {
                messagesContainer.removeChild(lastElement); 
            }

            let errorMessage = error.message.includes('HTTP error!') ? error.message.replace('HTTP error! status: ', '') : error.message;

            renderMessage({ role: 'model', text: '❌ Error: ' + errorMessage });
            console.error("Chat Error:", error);
        }
    });
    
    // 3. AUTH LISTENERS (MENGGUNAKAN EMAIL)
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // MENGAMBIL EMAIL
        const email = e.target['register-email'].value.trim(); 
        const password = e.target['register-password'].value.trim();

        if (password.length < MIN_LENGTH) {
            return alert(`Password wajib minimal ${MIN_LENGTH} karakter.`);
        }

        const confirmed = confirm("ANDA HARUS MENGINGAT SANDI DAN EMAIL AKUN INI! Kami tidak menyimpan fitur reset password. Apakah Anda ingin melanjutkan pendaftaran?");
        if (!confirmed) {
            return;
        }

        try {
            // ENDPOINT ALIGNED: /register
            const response = await axios.post('/register', { email, password }); 
            localStorage.setItem('token', response.data.token);
            const userEmail = response.data.user.email; 
            const { isPremium, chatCount } = response.data.user;
            showChatInterface({ email: userEmail }, isPremium, chatCount, true); 
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data;
            alert(errorMessage || 'Gagal register. Server error.');
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // MENGAMBIL EMAIL
        const email = e.target['login-email'].value.trim(); 
        const password = e.target['login-password'].value.trim();

        try {
            // ENDPOINT ALIGNED: /login
            const response = await axios.post('/login', { email, password }); 
            localStorage.setItem('token', response.data.token);
            const userEmail = response.data.user.email; 
            const { isPremium, chatCount } = response.data.user;
            showChatInterface({ email: userEmail }, isPremium, chatCount, true); 
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.response?.data;
            alert(errorMessage || 'Login gagal. Cek email/password.');
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
            // ENDPOINT ALIGNED: /user/me
            axios.get('/user/me', { headers: { Authorization: `Bearer ${token}` } })
                .then(response => {
                    const { isPremium, chatCount } = response.data.user;
                    const isNoSensorModeActive = isPremium || chatCount < FREE_LIMIT;
                    if (modelTitle) modelTitle.textContent = isNoSensorModeActive ? "Alpha AI" : "GPTfree (Sensor)";
                    updateFooterDisclaimer(isPremium, chatCount);
                    renderWelcomeMessage(isPremium, chatCount);
                    currentMessageCount = chatCount;
                })
                .catch(() => {
                    if (modelTitle) modelTitle.textContent = "GPTfree (Sensor)";
                    updateFooterDisclaimer(false, FREE_LIMIT); 
                    renderWelcomeMessage(false, FREE_LIMIT);
                    currentMessageCount = FREE_LIMIT;
                });
        } else {
             if (modelTitle) modelTitle.textContent = "GPTfree (Sensor)";
             updateFooterDisclaimer(false, FREE_LIMIT);
             renderWelcomeMessage(false, FREE_LIMIT);
             currentMessageCount = FREE_LIMIT;
        }
    });

    waButton.addEventListener('click', () => {
        const waNumber = '6285762008398';
        const message = encodeURIComponent("Halo Bro saya mau request update atau ada keluhan terkait Alpha AI.");
        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
    });

    upgradeButton.addEventListener('click', () => {
        alert('Fitur upgrade akan terhubung ke Midtrans.');
    });

    // Inisialisasi: Auto-Login Check
    checkAuthStatus();
});