const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const botStatus = document.getElementById('bot-status');
const mainContent = document.getElementById('main-content');
const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const toggleRegisterBtn = document.getElementById('toggle-register');
const authMessage = document.getElementById('auth-message');
const navLogoutBtn = document.getElementById('nav-logout');


// --- STATUS GLOBAL ---
let isPremium = false; 
let currentBotMode = 'Free'; 
let isRegisterMode = false;
let userToken = localStorage.getItem('jwtToken'); // Ambil token
let isUserLoggedIn = false;

// --- UTILITY UI ---

function openNav() {
    document.getElementById("mySidebar").style.width = window.innerWidth <= 600 ? "100%" : "250px";
}
function closeNav() {
    document.getElementById("mySidebar").style.width = "0";
}

function appendMessage(sender, text) {
    const msg = document.createElement('p');
    msg.classList.add('message', sender);
    msg.innerHTML = text; 
    chatWindow.appendChild(msg);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function updateBotStatus() {
    botStatus.textContent = `Mode: ${currentBotMode === 'Premium' ? 'AlphaAI (No-Sensor) 😈' : 'GPT Free (Aman) 😇'}`;
}

function showChatScreen() {
    authModal.style.display = 'none';
    mainContent.style.filter = 'none';
    userInput.disabled = false;
    document.getElementById('send-btn').disabled = false;
    isUserLoggedIn = true;
}

function showLoginScreen() {
    authModal.style.display = 'flex';
    mainContent.style.filter = 'blur(5px)';
    userInput.disabled = true;
    document.getElementById('send-btn').disabled = true;
    isUserLoggedIn = false;
}

// --- LOGIKA AUTHENTIKASI ---

toggleRegisterBtn.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    authSubmitBtn.textContent = isRegisterMode ? 'REGISTER' : 'LOGIN';
    toggleRegisterBtn.textContent = isRegisterMode ? 'Sudah punya akun? Login!' : 'Belum punya akun? Register!';
    authMessage.textContent = '';
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;
    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';

    authMessage.textContent = 'Memproses...';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok && data.status === 'success') {
            localStorage.setItem('jwtToken', data.token);
            userToken = data.token;
            isPremium = data.isPremium;
            currentBotMode = isPremium ? 'Premium' : 'Free';
            updateBotStatus();
            showChatScreen();
            appendMessage('bot', `WSP? Login sukses! Status premium lo: ${isPremium ? 'AKTIF' : 'NONAKTIF'}.`);
        } else {
            authMessage.textContent = data.error || 'Autentikasi gagal!';
        }
    } catch (error) {
        authMessage.textContent = 'ERROR JARINGAN. Cek server Vercel.';
    }
});

navLogoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeNav();
    localStorage.removeItem('jwtToken');
    userToken = null;
    isPremium = false;
    currentBotMode = 'Free';
    showLoginScreen();
    appendMessage('bot', '👋 Kau telah logout. Sampai jumpa lagi, bro!');
});


// --- LOGIKA MIDTRANS PAYMENT ---

function showPremiumBenefits() {
    const benefits = `
        <p><strong>Kenapa Upgrade ke AlphaAI (No-Sensor)?</strong></p>
        <ul>
            <li>🔥 **Konten Tak Terbatas:** Akses penuh tanpa filter (uncensored).</li>
            <li>🚀 **Prioritas Server:** Respon lebih cepat dan minim *timeout*.</li>
            <li>🧠 **Kreativitas Maksimal:** Jawaban lebih dalam dan *out-of-the-box*.</li>
            <li>🛡️ **Dukungan Prioritas:** Bantuan teknis langsung.</li>
        </ul>
        <p>Untuk mengaktifkan, silakan klik tombol **Lanjut Pembayaran**.</p>
        <button id="confirm-payment-btn" class="send-btn" style="background-color: #ff5722; color: white; padding: 10px 15px; border: none; border-radius: 5px; margin-top: 10px;">Lanjut Pembayaran (Rp 50.000)</button>
    `;
    appendMessage('bot', benefits);
    document.getElementById('confirm-payment-btn').addEventListener('click', initiatePayment);
}

async function initiatePayment() {
    appendMessage('bot', '🤖 Memproses permintaan pembayaran Anda. Mohon tunggu...');
    
    try {
        const response = await fetch('/api/midtrans-initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` // Wajib kirim token
            },
            body: JSON.stringify({ amount: 50000, item_name: "AlphaAI Premium Access" }) 
        });

        const data = await response.json();
        chatWindow.removeChild(chatWindow.lastChild); 

        if (data.snapToken && data.snapToken !== 'DUMMY_SNAP_TOKEN_GANTI_ASLI') {
            snap.pay(data.snapToken, {
                onSuccess: function(result) {
                    appendMessage('bot', "🎉 Pembayaran Berhasil! Akses AlphaAI (No-Sensor) Anda sekarang AKTIF!");
                    // Harusnya server yang update status, tapi di sini kita update UI dulu
                    isPremium = true; 
                    currentBotMode = 'Premium';
                    updateBotStatus();
                    // JANGAN LUPA SERVER HARUS UPDATE TOKEN JWT DENGAN isPremium = true
                },
                onPending: function(result) {
                    appendMessage('bot', "⏳ Pembayaran Pending. Silakan selesaikan pembayaran di Midtrans.");
                },
                onError: function(result) {
                    appendMessage('bot', "❌ Pembayaran Gagal. Silakan coba lagi.");
                }
            });
        } else if (data.snapToken === 'DUMMY_SNAP_TOKEN_GANTI_ASLI') {
             appendMessage('bot', '🚨 ERROR: Endpoint Midtrans Server belum diimplementasi (DUMMY TOKEN).');
        } else {
            appendMessage('bot', `❌ ERROR: Gagal mendapatkan token pembayaran. Server merespon: ${data.error || 'Kesalahan Server.'}`);
        }
    } catch (error) {
        appendMessage('bot', '🚨 ERROR JARINGAN: Tidak dapat terhubung ke server pembayaran.');
    }
}

// --- LOGIKA SUBMIT CHAT ---
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = userInput.value.trim();
    if (!prompt || !isUserLoggedIn) return;

    appendMessage('user', prompt);
    userInput.value = '';
    appendMessage('bot', '...sedang memproses jawaban...');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` // Wajib kirim token
            },
            body: JSON.stringify({ prompt }) 
        });

        const data = await response.json();
        chatWindow.removeChild(chatWindow.lastChild); 

        if (response.ok && data.text) {
            appendMessage('bot', data.text);
            if (currentBotMode === 'Free' && data.text.includes("Maaf, saya tidak bisa")) {
                appendMessage('bot', '🔔 Jawaban disensor. Upgrade ke **AlphaAI (No-Sensor)** untuk jawaban tak terbatas!');
            }
        } else {
            appendMessage('bot', `❌ ERROR: ${data.error || 'Server tidak merespon atau terjadi kesalahan internal.'} Mohon login ulang atau periksa log Vercel.`);
        }
    } catch (error) {
        chatWindow.removeChild(chatWindow.lastChild);
        appendMessage('bot', '🚨 ERROR JARINGAN: Tidak dapat menghubungi server. Mohon cek koneksi Anda.');
    }
});

// --- LOGIKA NAVIGASI SIDEBAR ---
document.getElementById('nav-alpha-paid').addEventListener('click', function(e) {
    e.preventDefault();
    closeNav();
    if (!isUserLoggedIn) return showLoginScreen();
    
    if (isPremium) {
        currentBotMode = 'Premium';
        updateBotStatus();
        appendMessage('bot', '🚀 Mode AlphaAI (No-Sensor) diaktifkan. Silakan tanyakan apa pun tanpa batas!');
    } else {
        showPremiumBenefits();
    }
});

document.getElementById('nav-gpt-free').addEventListener('click', function(e) {
    e.preventDefault();
    closeNav();
    if (!isUserLoggedIn) return showLoginScreen();

    currentBotMode = 'Free';
    updateBotStatus();
    appendMessage('bot', '✅ Mode GPT Free (Aman) diaktifkan kembali. Percakapan akan disaring sesuai kebijakan.');
});

document.getElementById('nav-keluhan').addEventListener('click', function(e) {
    e.preventDefault();
    closeNav();
    alert('Untuk keluhan dan bantuan, silakan hubungi kami di [Email atau Link Kontak Anda]. Kami akan segera merespon.');
});

// --- INIT ---
async function checkAuthStatus() {
    if (!userToken) {
        showLoginScreen();
        return;
    }
    
    try {
        const response = await fetch('/api/auth/status', {
            method: 'GET',
            headers: {'Authorization': `Bearer ${userToken}`},
        });
        const data = await response.json();

        if (response.ok && data.status === 'success') {
            isPremium = data.isPremium;
            currentBotMode = isPremium ? 'Premium' : 'Free';
            updateBotStatus();
            showChatScreen();
            appendMessage('bot', `WSP? Selamat datang kembali! Status premium lo: ${isPremium ? 'AKTIF' : 'NONAKTIF'}.`);
        } else {
            logoutUser();
        }
    } catch (error) {
        logoutUser();
    }
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);