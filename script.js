// --- 1. FIREBASE AYARLARI ---
// Bu kısmı kendi Firebase Console'dan aldığın bilgilerle doldurmalısın.
const firebaseConfig = {

  apiKey: "AIzaSyAKJ1R2XGjU4MG8wP_TYmw6KGdppJ-bA-Y",

  authDomain: "mesaitakip-8f655.firebaseapp.com",

  projectId: "mesaitakip-8f655",

  storageBucket: "mesaitakip-8f655.firebasestorage.app",

  messagingSenderId: "47606591744",

  appId: "1:47606591744:web:377d05c77fad72a7d9c3e5",

  measurementId: "G-BK6C7THVEQ"

};

// Firebase Başlatma
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase başlatılamadı, config ayarlarını kontrol et.");
}

const db = firebase.firestore();
const auth = firebase.auth();

// --- 2. GLOBAL DEĞİŞKENLER ---
let currentUser = null;
let currentMode = null; // 'mesai', 'izin', 'yillik-izin', 'vardiya'
let currentDate = new Date();
let userRecords = []; 
let selectedDateKey = null; 

// Tema Renkleri
const themes = {
    'mesai': 'var(--color-mesai)',
    'izin': 'var(--color-izin)',
    'yillik-izin': 'var(--color-yillik)',
    'vardiya': 'var(--color-vardiya)'
};

// --- 3. SAYFA YÜKLENDİĞİNDE ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme(); // Kayıtlı temayı yükle
    
    // Modal Dışı Tıklama ile Kapatma (Overlay Click)
    const modalOverlay = document.getElementById('entryModal');
    window.onclick = function(event) {
        if (event.target == modalOverlay) {
            closeModal();
        }
    }
});

// --- 4. AUTH (GİRİŞ/KAYIT) İŞLEMLERİ ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('authContainer').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
    } else {
        currentUser = null;
        document.getElementById('authContainer').classList.remove('hidden');
        document.getElementById('appContainer').classList.add('hidden');
    }
});

function handleAuth() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const errorP = document.getElementById('authError');
    const btnText = document.getElementById('authBtn').innerText;

    if (btnText === "Giriş Yap") {
        auth.signInWithEmailAndPassword(email, pass).catch(e => errorP.innerText = "Hata: " + e.message);
    } else {
        auth.createUserWithEmailAndPassword(email, pass).catch(e => errorP.innerText = "Hata: " + e.message);
    }
}

function toggleAuthMode() {
    const title = document.getElementById('authTitle');
    const isLogin = title.innerText === "Giriş Yap";
    
    title.innerText = isLogin ? "Kayıt Ol" : "Giriş Yap";
    document.getElementById('authBtn').innerText = isLogin ? "Kayıt Ol" : "Giriş Yap";
    document.getElementById('authToggle').innerText = isLogin ? "Hesabın var mı? Giriş Yap" : "Hesabın yok mu? Kayıt Ol";
    document.getElementById('authError').innerText = "";
}

function logout() {
    auth.signOut();
    goHome();
}

// --- 5. TEMA YÖNETİMİ ---
document.getElementById('themeToggle').addEventListener('click', () => {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    btn.innerHTML = theme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
}

// --- 6. NAVİGASYON ---
function openMode(mode) {
    currentMode = mode;
    // CSS Değişkenini güncelle (Tema Rengi)
    document.documentElement.style.setProperty('--theme-color', themes[mode]);
    
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('detailSection').classList.remove('hidden');
    document.getElementById('backBtn').classList.remove('hidden');
    
    // Yıllık izin sayacı görünümü
    if(mode === 'yillik-izin') {
        document.getElementById('infoBanner').classList.remove('hidden');
        calculateAnnualLeave();
    } else {
        document.getElementById('infoBanner').classList.add('hidden');
    }
    
    renderCalendar();
    fetchRecords();
}

function goHome() {
    currentMode = null;
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('detailSection').classList.add('hidden');
    document.getElementById('backBtn').classList.add('hidden');
    // Rengi varsayılana döndür
    document.documentElement.style.setProperty('--theme-color', '#6c5ce7');
}

// Geri Butonu ve Ay Değiştirme Butonları
document.getElementById('backBtn').addEventListener('click', goHome);
document.getElementById('prevMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); });
document.getElementById('nextMonth').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); });


// --- 7. VERİ ÇEKME & LİSTELEME ---
function fetchRecords() {
    if(!currentUser || !currentMode) return;
    
    db.collection('users').doc(currentUser.uid).collection('records')
      .where('type', '==', currentMode)
      .onSnapshot(snapshot => {
          userRecords = [];
          snapshot.forEach(doc => {
              userRecords.push({ id: doc.id, ...doc.data() });
          });
          renderList();
          renderCalendar(); // Takvimdeki noktaları güncelle
      });
}

function renderList() {
    const listEl = document.getElementById('actionList');
    listEl.innerHTML = '';
    
    // Tarihe göre sırala (Yeniden eskiye)
    const sorted = userRecords.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(item => {
        const li = document.createElement('li');
        li.className = 'list-item';
        
        let valDisplay = item.value;
        if(currentMode === 'mesai' && !valDisplay.includes('Saat')) valDisplay += " Saat";
        
        li.innerHTML = `
            <div>
                <div class="item-date">${item.date}</div>
                <div style="font-size:0.8rem; color:var(--text-light);">${item.desc || '-'}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="item-val">${valDisplay}</span>
                <i class="fa-solid fa-pen-to-square" style="cursor:pointer; color:var(--text-light);" onclick="openModal('${item.date}')"></i>
            </div>
        `;
        listEl.appendChild(li);
    });
}

function filterList() {
    const q = document.getElementById('searchInput').value.toLowerCase();
    document.querySelectorAll('.list-item').forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(q) ? 'flex' : 'none';
    });
}


// --- 8. MODAL İŞLEMLERİ (DÜZELTİLDİ) ---

// Modal Kapatma Fonksiyonu
function closeModal() {
    document.getElementById('entryModal').classList.add('hidden');
    selectedDateKey = null;
    
    // İçeriği temizle ki bir sonraki açılışta karışmasın
    document.getElementById('modalDesc').value = '';
    document.getElementById('modalDynamicInputs').innerHTML = '';
}

// Modal Açma Fonksiyonu
function openModal(dateKey) {
    selectedDateKey = dateKey;
    const modal = document.getElementById('entryModal');
    const dynamicArea = document.getElementById('modalDynamicInputs');
    const dateDisplay = document.getElementById('modalDateDisplay');
    const descInput = document.getElementById('modalDesc');
    const deleteBtn = document.getElementById('modalDeleteBtn');
    
    // Mevcut kaydı bul
    const existing = userRecords.find(r => r.date === dateKey);

    dateDisplay.innerText = `Seçilen Tarih: ${dateKey}`;
    descInput.value = existing ? existing.desc : '';
    
    // Sil butonu kontrolü
    if(existing) deleteBtn.classList.remove('hidden');
    else deleteBtn.classList.add('hidden');

    dynamicArea.innerHTML = ''; 

    // --- MODA GÖRE INPUT OLUŞTURMA ---
    
    // 1. MESAİ
    if(currentMode === 'mesai') {
        dynamicArea.innerHTML = `
            <input type="number" id="inputVal" placeholder="Mesai Saati (Örn: 2)" value="${existing ? existing.value : ''}">
        `;
    } 
    // 2. VARDİYA
    else if(currentMode === 'vardiya') {
        const opts = ['Gündüz', 'Öğlen', 'Gece'];
        let html = `<select id="inputVal">`;
        opts.forEach(o => {
            const selected = (existing && existing.value === o) ? 'selected' : '';
            html += `<option value="${o}" ${selected}>${o}</option>`;
        });
        html += `</select>`;
        dynamicArea.innerHTML = html;
    } 
    // 3. İZİN ve YILLIK İZİN
    else if(currentMode === 'izin' || currentMode === 'yillik-izin') {
        const isHalf = existing && existing.value === 'Yarım Gün';
        const isHourly = existing && existing.value.includes('Saat');
        
        let hourlyValue = '';
        if(isHourly) hourlyValue = existing.value.replace(' Saat', '');

        // Saatlik sadece 'izin' modunda gösterilsin (isteğe bağlı)
        const showHourly = (currentMode === 'izin');

        let html = `
            <div class="radio-group">
                <input type="radio" id="rd1" name="duration" value="Tam Gün" class="radio-input" ${(!isHalf && !isHourly) ? 'checked' : ''}>
                <label for="rd1" class="radio-label">Tam</label>
                
                <input type="radio" id="rd2" name="duration" value="Yarım Gün" class="radio-input" ${isHalf ? 'checked' : ''}>
                <label for="rd2" class="radio-label">Yarım</label>
        `;

        if(showHourly) {
            html += `
                <input type="radio" id="rd3" name="duration" value="Saatlik" class="radio-input" ${isHourly ? 'checked' : ''}>
                <label for="rd3" class="radio-label">Saatlik</label>
            `;
        }
        
        html += `</div>`; // radio-group bitiş

        // Saatlik Input (Gizli Başlar)
        html += `
            <div id="hourlyInputContainer" class="${isHourly ? '' : 'hidden'}" style="margin-bottom:15px;">
                <input type="number" id="hourlyInputVal" placeholder="Kaç Saat?" value="${hourlyValue}">
            </div>
        `;

        dynamicArea.innerHTML = html;

        // Radio Button Listener Ekleme (Input göster/gizle için)
        const radios = document.getElementsByName('duration');
        const container = document.getElementById('hourlyInputContainer');
        
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if(container) {
                    if(e.target.value === 'Saatlik') container.classList.remove('hidden');
                    else container.classList.add('hidden');
                }
            });
        });
    }

    modal.classList.remove('hidden');
}

function saveModalData() {
    if(!selectedDateKey || !currentUser) return;
    
    let val = null;
    const desc = document.getElementById('modalDesc').value;

    if(currentMode === 'mesai') {
        val = document.getElementById('inputVal').value;
        if(!val) return alert("Lütfen değer giriniz");
    } 
    else if(currentMode === 'vardiya') {
        val = document.getElementById('inputVal').value;
    }
    else {
        // İzin / Yıllık İzin Radyo kontrolü
        const radios = document.getElementsByName('duration');
        for(let r of radios) {
            if(r.checked) val = r.value;
        }

        if(val === 'Saatlik') {
            const hVal = document.getElementById('hourlyInputVal').value;
            if(!hVal) return alert("Lütfen saat giriniz");
            val = `${hVal} Saat`;
        }
    }

    const docId = `${selectedDateKey}_${currentMode}`;
    
    db.collection('users').doc(currentUser.uid).collection('records').doc(docId).set({
        date: selectedDateKey,
        type: currentMode,
        value: val,
        desc: desc
    }).then(() => {
        closeModal();
    }).catch(err => {
        alert("Hata: " + err.message);
    });
}

function deleteCurrentRecord() {
    if(!selectedDateKey || !currentUser) return;
    if(confirm('Silmek istediğine emin misin?')) {
        const docId = `${selectedDateKey}_${currentMode}`;
        db.collection('users').doc(currentUser.uid).collection('records').doc(docId).delete()
          .then(() => closeModal())
          .catch(err => alert("Hata: " + err.message));
    }
}


// --- 9. TAKVİM OLUŞTURMA ---
function renderCalendar() {
    const calendarDays = document.getElementById('calendarDays');
    calendarDays.innerHTML = '';
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    
    document.getElementById('currentMonthYear').innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayIndex = firstDay === 0 ? 6 : firstDay - 1;

    // Boş kutular
    for(let i=0; i<startDayIndex; i++) {
        calendarDays.appendChild(document.createElement('div'));
    }

    // Günler
    for(let i=1; i<=daysInMonth; i++) {
        const d = document.createElement('div');
        d.className = 'day';
        d.innerHTML = `${i}<div class="dot"></div>`;
        
        const key = `${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
        
        // Veri varsa işaretle
        if(userRecords.some(r => r.date === key)) d.classList.add('has-data');
        
        d.onclick = () => openModal(key);
        calendarDays.appendChild(d);
    }
}


// --- 10. YILLIK İZİN HESAPLAMA ---
function calculateAnnualLeave() {
    if(!currentUser) return;
    db.collection('users').doc(currentUser.uid).collection('records')
      .where('type', '==', 'yillik-izin').get()
      .then(snapshot => {
          let used = 0;
          snapshot.forEach(doc => {
              const d = doc.data();
              if(d.value === 'Yarım Gün') used += 0.5;
              else if(d.value === 'Tam Gün') used += 1.0;
              // Yıllık izinde saatlik kullanım genelde olmaz ama olursa buraya eklenebilir.
          });
          
          const remaining = 14 - used;
          const infoText = document.getElementById('infoText');
          infoText.innerText = `Kalan Yıllık İzin: ${remaining} Gün`;
          
          if(remaining <= 0) infoText.style.background = "#d63031"; // Kırmızı uyarı
          else infoText.style.background = "var(--theme-color)";
      });
}

// --- IOS ANA EKRANA EKLEME KONTROLÜ ---

// Sayfa yüklendiğinde kontrol et
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cihaz iOS mu? (iPhone, iPad, iPod)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    // 2. Uygulama "Standalone" (Ana Ekran) modunda DEĞİL mi?
    // (Yani şu an Safari içinde miyiz?)
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    // Sadece iOS ise ve henüz ana ekrana eklenmemişse butonu göster
    if (isIOS && !isStandalone) {
        document.getElementById('iosInstallBtn').classList.remove('hidden');
    }
});

function showIosInstructions() {
    document.getElementById('iosInstallModal').classList.remove('hidden');
}

function closeIosModal() {
    document.getElementById('iosInstallModal').classList.add('hidden');
}