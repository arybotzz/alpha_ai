// public/app.js - Logic Frontend Full Stack (LENGKAP SEMPURNA)

// ====================================================================
// 🚨 KONFIGURASI KRITIS: GANTI DENGAN KUNCI MIDTRANS LO
// ====================================================================
const MIDTRANS_CLIENT_KEY = "<GANTI_DENGAN_CLIENT_KEY_MIDTRANS_LO>"; // Ganti dengan Client Key Midtrans Sandbox Lo
const API_BASE_URL = window.location.origin; 

// ====================================================================
// VARIABEL GLOBAL & DOM 
// ====================================================================
let isRegisterMode = false;
let isPremium = false;
let currentUsername = '';

const authArea = document.getElementById('auth-area');
const chatArea = document.getElementById('chat-area');
const sidebar = document.getElementById('sidebar');

const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authMessage = document.getElementById('auth-message');
const switchAuthButton = document.getElementById('switch-auth');
const submitButton = document.getElementById('submit-button');

const chatWindow = document.getElementById('chat-window');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const logoutButton = document.getElementById('logout-button');
const upgradeButton = document.getElementById('upgrade-button');

const userInfo = document.getElementById('user-info');
const currentMode = document.getElementById('current-mode');
const chatHeaderMode = document.getElementById('chat-header-mode');

// ====================================================================
// FUNGSI UTILITY
// ====================================================================

function displayMessage(sender, text) {
    const messageDiv = document.createElement('div');
    const senderColor = sender === 'User' ? 'bg-blue-600' : 'bg-gray-700';
    const align = sender === 'User' ? 'self-end' : 'self-start';

    messageDiv.className = `max-w-xs md:max-w-lg p-3 rounded-xl ${senderColor} ${align} flex flex-col`;
    messageDiv.innerHTML = `
        <span class="text-xs font-bold ${sender === 'User' ? 'text-white' : 'text-red-400'} mb-1">${sender}</span>
        <span class="whitespace-pre-wrap">${text}</span>
    `;
    chatWindow.appendChild(messageDiv);
    chatWindow.scrollTop = chatWindow.scrollHeight; 
}

function updateUI() {
    // 1. Sidebar Mode
    const modeName = isPremium ? 'ALPHA AI (Premium)' : 'GPT Free';
    currentMode.innerHTML = `<i class="fas fa-robot mr-3"></i> <span>Mode: ${modeName}</span>`;
    currentMode.classList.toggle('bg-red-700/50', !isPremium);
    currentMode.classList.toggle('bg-green-700/50', isPremium);
    
    // 2. Chat Header
    chatHeaderMode.textContent = modeName;

    // 3. Upgrade Button
    if (isPremium) {
        upgradeButton.textContent = 'ALPHA AI Aktif!';
        upgradeButton.classList.remove('bg-green-600', 'hover:bg-green-700');
        upgradeButton.classList.add('bg-gray-500', 'cursor-not-allowed');
        upgradeButton.disabled = true;
    } else {
        upgradeButton.textContent = 'Beralih ke ALPHA AI (Premium)';
        upgradeButton.classList.add('bg-green-600', 'hover:bg-green-700');
        upgradeButton.classList.remove('bg-gray-500', 'cursor-not-allowed');
        upgradeButton.disabled = false;
    }

    // 4. User Info
    userInfo.textContent = `Logged in as: ${currentUsername} (${isPremium ? 'Premium' : 'Free'})`;

    // 5. Tampilkan/Sembunyikan Area
    authArea.classList.add('hidden');
    chatArea.classList.remove('hidden');
    sidebar.classList.remove('hidden');
}

// ====================================================================
// FUNGSI JWT DECODE (HACK FRONTEND)
// ====================================================================

function jwt_decode(token) {
    if (!token) return {};
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT Decode Error", e);
        return {};
    }
}

// ====================================================================
// FUNGSI UTAMA (AUTH & INIT)
// ====================================================================

async function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (!token) {
        authArea.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/status`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();
            currentUsername = localStorage.getItem('username') || 'User'; 
            isPremium = data.isPremium;
            updateUI();
            if (chatWindow.children.length === 0) {
                 displayMessage('AI', `Selamat datang kembali, ${currentUsername}! Anda menggunakan Mode ${isPremium ? 'ALPHA AI (Premium)' : 'GPT Free'}.`)
            }
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            authArea.classList.remove('hidden');
        }

    } catch (error) {
        console.error("Error checking auth status:", error);
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        authArea.classList.remove('hidden');
    }
}

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authMessage.classList.add('hidden');

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    
    submitButton.disabled = true;
    submitButton.textContent = isRegisterMode ? 'Mendaftar...' : 'Memproses Login...';

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', username);
            currentUsername = username;
            isPremium = data.isPremium;
            
            updateUI();
            displayMessage('AI', `Selamat datang, ${username}! Anda menggunakan Mode GPT Free.`)
        } else {
            authMessage.textContent = data.error || 'Terjadi kesalahan saat otentikasi.';
            authMessage.classList.remove('hidden');
        }

    } catch (error) {
        authMessage.textContent = 'Server tidak merespons. Cek koneksi Vercel.';
        authMessage.classList.remove('hidden');
        console.error("Fetch Error:", error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = isRegisterMode ? 'Register' : 'Login';
    }
});

// ====================================================================
// FUNGSI CHAT & AI
// ====================================================================

async function sendMessage() {
    const prompt = chatInput.value.trim();
    if (!prompt) return;

    displayMessage('User', prompt);
    chatInput.value = ''; 

    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'max-w-lg p-3 rounded-xl bg-gray-700 self-start flex flex-col';
    loadingMessage.innerHTML = '<span class="text-xs font-bold text-red-400 mb-1">AI</span><span id="loading-dots">Memproses...</span>';
    chatWindow.appendChild(loadingMessage);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ prompt })
        });

        chatWindow.removeChild(loadingMessage); 

        if (response.ok) {
            const data = await response.json();
            displayMessage('AI', data.text);
        } else {
            const errorData = await response.json();
            displayMessage('AI', `[ERROR]: ${errorData.error || 'Gagal terhubung ke AI.'}`);
        }

    } catch (error) {
        chatWindow.removeChild(loadingMessage); 
        displayMessage('AI', `[KONEKSI GAGAL]: Server crash atau error jaringan.`);
        console.error("Chat Error:", error);
    }
}

// ====================================================================
// EVENT LISTENERS 
// ====================================================================

sendButton.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

logoutButton.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    location.reload(); 
});

switchAuthButton.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;

    if (isRegisterMode) {
        authTitle.textContent = 'REGISTER';
        submitButton.textContent = 'Register';
        switchAuthButton.textContent = 'Sudah punya akun? Login!';
    } else {
        authTitle.textContent = 'LOGIN';
        submitButton.textContent = 'Login';
        switchAuthButton.textContent = 'Belum punya akun? Register!';
    }
    authMessage.classList.add('hidden');
    authForm.reset();
});

// Logic untuk Upgrade/Midtrans Redirect
upgradeButton.addEventListener('click', async () => {
    if (isPremium) return; 

    const token = localStorage.getItem('token');
    const decodedToken = jwt_decode(token);
    const userId = decodedToken.id; 
    const price = 50000; 

    if (!userId) {
        alert("Gagal mengidentifikasi user ID. Silakan login ulang.");
        return;
    }

    // DUMMY SNAP TOKEN (Ganti dengan token nyata dari Midtrans)
    const snapTokenDummy = 'DUMMY_SNAP_TOKEN_DARI_MIDTRANS_SERVER'; 

    if (window.snap) {
        window.snap.pay(snapTokenDummy, {
            onSuccess: function(result){
                alert("Pembayaran Berhasil! Status Anda akan di-update.");
                setTimeout(checkAuthStatus, 5000); 
            },
            onPending: function(result){
                alert("Pembayaran Pending. Silakan selesaikan pembayaran.");
            },
            onError: function(result){
                alert("Pembayaran Gagal. Coba lagi!");
            },
            onClose: function(){
                // user menutup popup
            }
        });
    } else {
        alert("Midtrans Snap.js gagal dimuat. Pastikan client key di index.html sudah benar.");
    }
});


// ====================================================================
// INIT
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    const clientKeyElement = document.querySelector('script[data-client-key]');
    if (clientKeyElement && clientKeyElement.getAttribute('data-client-key') === "<GANTI_DENGAN_CLIENT_KEY_MIDTRANS_LO>") {
        console.error("PERINGATAN: GANTI KUNCI MIDTRANS CLIENT KEY di index.html!");
    }
    if (MIDTRANS_CLIENT_KEY === "<GANTI_DENGAN_CLIENT_KEY_MIDTRANS_LO>") {
         console.error("PERINGATAN: GANTI KUNCI MIDTRANS CLIENT KEY di app.js!");
    }
    checkAuthStatus();
});