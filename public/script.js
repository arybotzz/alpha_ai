// public/script.js (FINAL FIX)

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
let userToken = localStorage.getItem('jwtToken'); 
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
    const premiumBtn = document.getElementById('nav-alpha-paid');
    if (isPremium) {
        premiumBtn.textContent = '🔥 AlphaAI (Premium Aktif)';
        premiumBtn.style.color = '#28a745'; 
        premiumBtn.removeEventListener('click', showPremiumBenefits);
    } else {
        premiumBtn.textContent = '🔥 AlphaAI (No-Sensor) - Beli';
        premiumBtn.style.color = '#ffc107'; 
        premiumBtn.addEventListener('click', showPremiumBenefits);
    }
}

function showChatScreen() {
    authModal.style.display = 'none';
    mainContent.style.filter = 'none';
    userInput.disabled = false;
    document.getElementById('send-btn').disabled = false;
    isUserLoggedIn = true;
    appendMessage('bot', '👋 Selamat datang! Silakan mulai chat.');
}

function showLoginScreen() {
    authModal.style.display = 'flex';
    mainContent.style.filter = 'blur(5px)';
    userInput.disabled = true;
    document.getElementById('send-btn').disabled = true;
    isUserLoggedIn = false;
    chatWindow.innerHTML = '<p class="message bot">Harap Login untuk menggunakan ALPHA-AI.</p>';
}

function logoutUser() {
    localStorage.removeItem('jwtToken');
    userToken = null;
    isPremium = false;
    currentBotMode = 'Free';
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
            authMessage.textContent = 'Login sukses!';
        } else {
            authMessage.textContent = data.error || 'Autentikasi gagal! Password atau Username salah.';
        }
    } catch (error) {
        // ERROR JARINGAN ATAU SERVER CRASH DITAMPILKAN DI SINI
        authMessage.textContent = 'ERROR JARINGAN. Cek server Vercel atau koneksi MongoDB.';
    }
});

navLogoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    closeNav();
    logoutUser();
    showLoginScreen(); 
});

// Listener untuk link statis
['nav-tentang', 'nav-ketentuan', 'nav-privasi'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', (e) => {
            e.preventDefault();
            closeNav();
            window.open(element.getAttribute('href'), '_blank');
        });
    }
});


// --- LOGIKA MIDTRANS PAYMENT ---

function showPremiumBenefits(e) {
    e.preventDefault();
    closeNav();

    if (isPremium) return; // Sudah premium, batalkan

    const benefits = `
        <p><strong>Kenapa Upgrade ke AlphaAI (No-Sensor)?</strong></p>
        <ul>
            <li>🔥 **Konten Tak Terbatas:** Akses penuh tanpa filter (uncensored).</li>
            <li>🚀 **Prioritas Server:** Respon lebih cepat dan minim *timeout*.</li>
            <li>🧠 **Kreativitas Maksimal:** Jawaban lebih dalam dan *out-of-the-box*.</li>
        </ul>
        <p>Untuk mengaktifkan, silakan klik tombol **Lanjut Pembayaran**.</p>
        <button id="confirm-payment-btn" class="send-btn" style="background-color: #ff5722; color: white; padding: 10px 15px; border: none; border-radius: 5px; margin-top: 10px;">Lanjut Pembayaran (Rp 50.000)</button>
    `;
    appendMessage('bot', benefits);
    document.getElementById('confirm-payment-btn').addEventListener('click', initiatePayment);
}

async function initiatePayment() {
    appendMessage('bot', '🤖 Memproses permintaan pembayaran Anda. Mohon tunggu...');
    
    if (!userToken) {
        chatWindow.removeChild(chatWindow.lastChild);
        appendMessage('bot', '🚨 ERROR: Lo harus login dulu untuk melakukan pembelian premium!');
        return;
    }

    try {
        // ASUMSI: Endpoint ini akan memanggil Midtrans API (diimplementasikan di server.js)
        const response = await fetch('/api/midtrans-initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${userToken}` 
            },
            body: JSON.stringify({ amount: 50000, item_name: "AlphaAI Premium Access" }) 
        });

        const data = await response.json();
        chatWindow.removeChild(chatWindow.lastChild); 

        if (data.snapToken) {
            // Cek jika Snap Token valid atau dummy
            if (data.snapToken === 'DUMMY_SNAP_TOKEN_GANTI_ASLI') {
                 appendMessage('bot', `❌ ERROR: Snap Token masih DUMMY. Implementasikan Midtrans Client di server.js!`);
                 return;
            }

            snap.pay(data.snapToken, {
                onSuccess: function(result) {
                    appendMessage('bot', "🎉 Pembayaran Berhasil! Akses AlphaAI (No-Sensor) Anda sekarang AKTIF!");
                    logoutUser(); // Logout paksa agar token baru diambil saat login
                    showLoginScreen();
                    alert("Pembayaran sukses! Silakan login kembali untuk mengaktifkan status Premium.");
                },
                onPending: function(result) {
                    appendMessage('bot', "⏳ Pembayaran Pending. Silakan selesaikan pembayaran di Midtrans.");
                },
                onError: function(result) {
                    appendMessage('bot', "❌ Pembayaran Gagal. Silakan coba lagi.");
                }
            });
        } else {
             appendMessage('bot', `❌ ERROR: Gagal mendapatkan token pembayaran. ${data.error || ''}`);
        }
    } catch (error) {
        chatWindow.removeChild(chatWindow.lastChild);
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
                'Authorization': `Bearer ${userToken}` 
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
            appendMessage('bot', `❌ ERROR: ${data.error || 'Server tidak merespon.'} Mohon login ulang atau periksa log Vercel.`);
        }
    } catch (error) {
        chatWindow.removeChild(chatWindow.lastChild);
        appendMessage('bot', '🚨 ERROR JARINGAN: Tidak dapat menghubungi server. Mohon cek koneksi Anda.');
    }
});


// --- INIT ---
async function checkAuthStatus() {
    if (!userToken) {
        updateBotStatus();
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
        } else {
            logoutUser();
        }
    } catch (error) {
        // Kegagalan koneksi server saat inisialisasi
        logoutUser();
        showLoginScreen(); 
    }
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);