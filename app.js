// EmailJS inicializálása
(function() {
    // Ellenőrizzük, hogy a konfiguráció be van-e töltve
    if (typeof EMAILJS_CONFIG !== 'undefined' && EMAILJS_CONFIG.PUBLIC_KEY !== 'your_public_key') {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    } else {
        console.warn('EmailJS konfiguráció hiányzik vagy nem megfelelő. Kérjük, állítsa be az emailjs-config.js fájlban.');
    }
})();

// ✅ ADMIN PANEL VERZIÓ
const ADMIN_PANEL_VERSION = 'v1.3.0';

// ✅ CACHE KEZELŐ RENDSZER
class FirebaseCache {
    constructor() {
        this.CACHE_DURATION = 60 * 60 * 1000; // 60 perc milliszekundumban (növeltük 30-ról)
        this.CACHE_VERSION = 'v1.3'; // ✅ Cache verzió frissítve a változás miatt
        this.CACHE_KEYS = {
            USER_EVENTS: 'firebase_cache_user_events',
            USAGE_STATS: 'firebase_cache_usage_stats',
            LICENSES: 'firebase_cache_licenses'
        };
        
        // ✅ Verzió ellenőrzés és hibás cache-ek törlése
        this.checkAndClearOldCache();
    }

    // ✅ Régi cache verzió törlése
    checkAndClearOldCache() {
        const currentVersion = localStorage.getItem('firebase_cache_version');
        if (currentVersion !== this.CACHE_VERSION) {
            console.log(`🔄 Cache version mismatch - clearing old cache data (${currentVersion} → ${this.CACHE_VERSION})`);
            this.cleanup();
            localStorage.setItem('firebase_cache_version', this.CACHE_VERSION);
        } else {
            console.log(`✅ Cache version OK: ${this.CACHE_VERSION}`);
        }
    }

    // Cache adatok lekérése
    get(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;

            const data = JSON.parse(cached);
            const now = new Date().getTime();
            
            // Ellenőrizzük, hogy lejárt-e a cache
            if (now - data.timestamp > this.CACHE_DURATION) {
                localStorage.removeItem(key);
                return null;
            }

            console.log(`📦 Cache HIT: ${key} (${((now - data.timestamp) / 1000 / 60).toFixed(1)} perc régi)`);
            return data.value;
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    }

    // Adatok mentése cache-be
    set(key, value) {
        try {
            const data = {
                timestamp: new Date().getTime(),
                value: value
            };
            localStorage.setItem(key, JSON.stringify(data));
            console.log(`💾 Cache SAVED: ${key} (${value.length || Object.keys(value).length} items)`);
        } catch (error) {
            console.error('Cache write error:', error);
            // Ha nincs hely, töröljük a legrégebbi cache-eket
            this.cleanup();
        }
    }

    // Cache tisztítás
    cleanup() {
        Object.values(this.CACHE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('🧹 Cache cleared');
    }

    // Cache frissítés kényszerítése
    forceRefresh(key) {
        localStorage.removeItem(key);
        console.log(`🔄 Cache INVALIDATED: ${key}`);
    }

    // Cache státusz lekérése
    getStatus() {
        const status = {};
        Object.entries(this.CACHE_KEYS).forEach(([name, key]) => {
            const cached = localStorage.getItem(key);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    const age = (new Date().getTime() - data.timestamp) / 1000 / 60; // perc
                    status[name] = {
                        age: age.toFixed(1) + ' perc',
                        size: new Blob([cached]).size,
                        valid: age < (this.CACHE_DURATION / 1000 / 60)
                    };
                } catch (e) {
                    status[name] = { error: 'Invalid cache data' };
                }
            } else {
                status[name] = { status: 'Not cached' };
            }
        });
        return status;
    }
}

// Globális cache instance
const firebaseCache = new FirebaseCache();

// ✅ Helper funkció a biztonságos Date konverzióhoz
function safeToDate(timestamp) {
    try {
        if (timestamp instanceof Date) {
            return timestamp;
        }
        if (timestamp && timestamp.toDate && typeof timestamp.toDate === 'function') {
            return timestamp.toDate();
        }
        if (timestamp) {
            const date = new Date(timestamp);
            return isNaN(date.getTime()) ? new Date() : date;
        }
        return new Date();
    } catch (error) {
        console.warn('Date conversion error:', error, 'Using current date as fallback');
        return new Date();
    }
}

// Email küldése licensz kulccsal
async function sendLicenseEmail(customerName, customerEmail, licenseKey, expiryDate) {
    // Ellenőrizzük a konfigurációt
    if (typeof EMAILJS_CONFIG === 'undefined' || EMAILJS_CONFIG.PUBLIC_KEY === 'your_public_key') {
        throw new Error('EmailJS konfiguráció hiányzik. Kérjük, állítsa be az emailjs-config.js fájlban.');
    }

    const templateParams = {
        to_name: customerName,
        to_email: customerEmail,
        license_key: licenseKey,
        expiry_date: expiryDate.toLocaleDateString('hu-HU'),
        company_name: 'IrriPlanner'
    };

    try {
        const response = await emailjs.send(EMAILJS_CONFIG.SERVICE_ID, EMAILJS_CONFIG.TEMPLATE_ID, templateParams);
        console.log('Email sikeresen elküldve:', response.status, response.text);
        return true;
    } catch (error) {
        console.error('Email küldési hiba:', error);
        throw error;
    }
}

// Login function
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        showAdminPanel();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

// Show admin panel after successful login
function showAdminPanel() {
    document.getElementById('loginForm').classList.add('d-none');
    document.getElementById('adminPanel').classList.remove('d-none');
    
    // ✅ Verziószám megjelenítése
    displayAdminVersion();
    
    loadLicenses();
    loadAndDisplayCurrentVersion();
    loadUsageStats(); // Load usage statistics
}

// ✅ Admin panel verziószám megjelenítése
function displayAdminVersion() {
    const versionElement = document.getElementById('adminVersion');
    if (versionElement) {
        versionElement.textContent = ADMIN_PANEL_VERSION;
    }
}

// Generate new license
async function generateLicense() {
    const customerName = document.getElementById('customerName').value;
    const customerEmail = document.getElementById('customerEmail').value;
    const months = parseInt(document.getElementById('validityMonths').value);
    const sendEmail = document.getElementById('sendEmailNotification').checked;

    if (!customerName || !customerEmail || !months) {
        alert('Kérjük, töltse ki az összes mezőt');
        return;
    }

    const licenseKey = generateLicenseKey();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    try {
        // Licensz mentése az adatbázisba
        await db.collection('licenses').doc(licenseKey).set({
            customerName,
            customerEmail,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiryDate,
            activatedBy: null,
            lastUsed: null
        });

        // Email küldése, ha be van jelölve
        if (sendEmail) {
            try {
                await sendLicenseEmail(customerName, customerEmail, licenseKey, expiryDate);
                alert(`Licensz generálva és email elküldve: ${licenseKey}`);
            } catch (emailError) {
                alert(`Licensz generálva: ${licenseKey}\nEmail küldési hiba: ${emailError.message}`);
            }
        } else {
            alert(`Licensz generálva: ${licenseKey}`);
        }

        // Mezők törlése és lista frissítése
        document.getElementById('customerName').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('validityMonths').value = '1';
        loadLicenses();
    } catch (error) {
        alert('Hiba a licensz generálásakor: ' + error.message);
    }
}

// Generate random license key
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segmentLength = 4;
    let key = '';

    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < segmentLength; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < segments - 1) key += '-';
    }

    return key;
}

// Load and display licenses
async function loadLicenses() {
    const activeLicensesTable = document.getElementById('activeLicenseList');
    const inactiveLicensesTable = document.getElementById('inactiveLicenseList');
    
    activeLicensesTable.innerHTML = '';
    inactiveLicensesTable.innerHTML = '';

    try {
        const snapshot = await db.collection('licenses').get();
        const currentDate = new Date();
        
        snapshot.forEach(doc => {
            const license = doc.data();
            const activatedDate = license.activatedAt ? license.activatedAt.toDate().toLocaleDateString() : 'Nem aktivált';
            const lastUsedDate = license.lastUsed ? license.lastUsed.toDate().toLocaleDateString() : 'Soha';
            const expiryDate = license.expiresAt.toDate();
            
            // Check if license is expired or not activated
            let displayStatus = license.status;
            let isActive = license.status === 'active';
            
            // If expiry date is in the past, consider it inactive
            if (expiryDate < currentDate && isActive) {
                displayStatus = 'inactive (expired)';
                isActive = false;
            }
            
            // If not activated yet, consider it inactive
            if (!license.activatedAt && isActive) {
                displayStatus = 'inactive (not activated)';
                isActive = false;
            }
            
            const row = `
                <tr>
                    <td>${doc.id}</td>
                    <td>${license.customerName}</td>
                    <td>${displayStatus}</td>
                    <td>${expiryDate.toLocaleDateString()}</td>
                    <td>${activatedDate}</td>
                    <td>${lastUsedDate}</td>
                    <td>
                        <button onclick="revokeLicense('${doc.id}')" class="btn btn-sm btn-danger">Revoke</button>
                        <button onclick="deleteLicense('${doc.id}')" class="btn btn-sm btn-warning ms-1">Törlés</button>
                    </td>
                </tr>
            `;
            
            // Determine if license is active or inactive based on our checks
            if (isActive) {
                activeLicensesTable.innerHTML += row;
            } else {
                inactiveLicensesTable.innerHTML += row;
            }
        });
    } catch (error) {
        console.error('Error loading licenses:', error);
    }
}

// Revoke license
async function revokeLicense(licenseKey) {
    if (confirm('Are you sure you want to revoke this license?')) {
        try {
            await db.collection('licenses').doc(licenseKey).update({
                status: 'revoked'
            });
            loadLicenses();
        } catch (error) {
            alert('Error revoking license: ' + error.message);
        }
    }
}

// Delete license
async function deleteLicense(licenseKey) {
    if (confirm('Biztosan törölni szeretné ezt a licenszet?')) {
        try {
            await db.collection('licenses').doc(licenseKey).delete();
            loadLicenses();
        } catch (error) {
            alert('Hiba a licensz törlésekor: ' + error.message);
        }
    }
}

// Save the latest application version
async function saveLatestVersion() {
    const versionInput = document.getElementById('latestVersion');
    const latestVersion = versionInput.value.trim();

    if (!latestVersion) {
        alert('Please enter a version number (e.g., 1.1.0)');
        return;
    }

    // Use a specific document for app info, e.g., 'app_info/latest_version'
    const versionDocRef = db.collection('app_info').doc('latest_version');

    try {
        await versionDocRef.set({
            versionNumber: latestVersion,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // Use merge:true to avoid overwriting other potential fields

        alert(`Latest version saved: ${latestVersion}`);
        displayCurrentSavedVersion(latestVersion); // Update display immediately
        versionInput.value = ''; // Clear input after save

    } catch (error) {
        alert('Error saving version: ' + error.message);
        console.error('Error saving version:', error);
    }
}

// Load and display the current saved version
async function loadAndDisplayCurrentVersion() {
    const versionDocRef = db.collection('app_info').doc('latest_version');
    try {
        const docSnap = await versionDocRef.get();
        if (docSnap.exists) {
            const versionData = docSnap.data();
            displayCurrentSavedVersion(versionData.versionNumber || '-');
        } else {
            displayCurrentSavedVersion('-'); // No version saved yet
        }
    } catch (error) {
        console.error('Error loading current version:', error);
        displayCurrentSavedVersion('Error');
    }
}

// Helper to update the display span
function displayCurrentSavedVersion(version) {
    const displayElement = document.getElementById('currentSavedVersion');
    if (displayElement) {
        displayElement.textContent = version;
    }
}

// Load usage statistics
async function loadUsageStats() {
    try {
        let usageData = null;
        let isFromCache = false;

        // ✅ 1. CACHE ELLENŐRZÉS - USAGE STATS
        const cachedUsageStats = firebaseCache.get(firebaseCache.CACHE_KEYS.USAGE_STATS);

        if (cachedUsageStats) {
            // Van érvényes cache
            usageData = cachedUsageStats;
            isFromCache = true;
            console.log('📦 Using cached usage stats');
            
            // ✅ FIX: Timestamp string-ek visszaalakítása Date objektumokká
            usageData = usageData.map(record => ({
                ...record,
                timestamp: safeToDate(record.timestamp)
            }));
        } else {
            // ✅ 2. FIREBASE LEKÉRÉS
            console.log('🔄 Loading fresh usage stats from Firebase...');
            
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            
            const snapshot = await db.collection('usage_stats')
                .where('timestamp', '>=', sevenDaysAgo)
                .orderBy('timestamp', 'desc')
                .get(); // Eltávolítottuk a limit-et a teljes adat eléréséhez

            // Adatok átalakítása cache-eléshez
            usageData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: safeToDate(doc.data().timestamp)
            }));

            // ✅ 3. CACHE MENTÉS
            firebaseCache.set(firebaseCache.CACHE_KEYS.USAGE_STATS, usageData);
        }

        // ✅ 4. ADATFELDOLGOZÁS
        const now = new Date();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const uniqueMachines = new Set();
        const licensedMachines = new Set();
        const freeMachines = new Set();
        const todayActiveMachines = new Set();

        usageData.forEach(record => {
            const machineId = record.machineId;
            const timestamp = record.timestamp;

            uniqueMachines.add(machineId);

            if (record.isLicensed) {
                licensedMachines.add(machineId);
            } else {
                freeMachines.add(machineId);
            }

            if (timestamp >= todayStart) {
                todayActiveMachines.add(machineId);
            }
        });

        // ✅ 5. UI FRISSÍTÉS
        document.getElementById('totalUniqueUsers').textContent = uniqueMachines.size;
        document.getElementById('licensedUsers').textContent = licensedMachines.size;
        document.getElementById('freeUsers').textContent = freeMachines.size;
        document.getElementById('todayActiveUsers').textContent = todayActiveMachines.size;

        // ✅ 6. CACHE STÁTUSZ LOG
        if (isFromCache) {
            console.log(`📦 Usage stats from cache: ${usageData.length} records`);
        } else {
            console.log(`🔄 Fresh usage stats loaded: ${usageData.length} records (cached for 60 min)`);
        }

    } catch (error) {
        console.error('Error loading usage stats:', error);
        alert('Error loading usage statistics: ' + error.message);
    }
}

// Refresh usage statistics
function refreshUsageStats() {
    // ✅ Cache törlése a friss adatok betöltéséhez
    firebaseCache.forceRefresh(firebaseCache.CACHE_KEYS.USAGE_STATS);
    loadUsageStats();
}

// === ANALYTICS FUNCTIONS ===

// Paginálási változók
let currentMachineListPage = 0;
const MACHINES_PER_PAGE = 20;
let allMachines = [];

// Load machine list with user information
async function loadMachineList(isLoadMore = false) {
    const machineListDiv = document.getElementById('machineList');
    
    if (!isLoadMore) {
        machineListDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Betöltés...</div>';
        currentMachineListPage = 0;
        allMachines = [];
    }

    try {
        let eventsData = null;
        let licenseData = null;
        let isFromCache = false;

        // ✅ 1. CACHE ELLENŐRZÉS - USER EVENTS
        const cachedEvents = firebaseCache.get(firebaseCache.CACHE_KEYS.USER_EVENTS);
        const cachedLicenses = firebaseCache.get(firebaseCache.CACHE_KEYS.LICENSES);

        if (cachedEvents && cachedLicenses) {
            // Van érvényes cache - használjuk azt
            eventsData = cachedEvents;
            licenseData = cachedLicenses;
            isFromCache = true;
            console.log('📦 Using cached data for machine list');
            
            // ✅ FIX: Timestamp string-ek visszaalakítása Date objektumokká
            eventsData = eventsData.map(event => ({
                ...event,
                timestamp: safeToDate(event.timestamp)
            }));
        } else {
            // ✅ 2. FIREBASE LEKÉRÉS - 48 ÓRÁS IDŐSZŰRŐVEL ÉS LIMITTEL
            console.log('🔄 Loading fresh data from Firebase (last 48 hours)...');
            
            // 48 órával ezelőtti időpont
            const now = new Date();
            const twoDaysAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));
            
            // User events betöltése - csak az elmúlt 48 óra, max 500 esemény
            const eventsSnapshot = await db.collection('user_events')
                .where('timestamp', '>=', twoDaysAgo)
                .orderBy('timestamp', 'desc')
                .limit(500)
                .get();
            
            // Licenses betöltése
            const licensesSnapshot = await db.collection('licenses').get();

            // Adatok cache-elése
            eventsData = eventsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: safeToDate(doc.data().timestamp)
            }));

            licenseData = {};
            licensesSnapshot.forEach(doc => {
                licenseData[doc.id] = doc.data();
            });

            // ✅ 3. CACHE MENTÉS
            firebaseCache.set(firebaseCache.CACHE_KEYS.USER_EVENTS, eventsData);
            firebaseCache.set(firebaseCache.CACHE_KEYS.LICENSES, licenseData);
        }

        // ✅ 4. ADATFELDOLGOZÁS (ugyanaz, mint korábban)
        const machineData = {};

        eventsData.forEach(eventDoc => {
            const data = eventDoc;
            const machineId = data.machine_id;
            const timestamp = data.timestamp;
            
            // Skip events with null or undefined machine_id
            if (!machineId) {
                console.warn('Skipping event with null/undefined machine_id:', data);
                return;
            }

            if (!machineData[machineId]) {
                machineData[machineId] = {
                    machineId,
                    lastActivity: timestamp,
                    sessionCount: new Set(),
                    appVersion: data.app_version || 'unknown',
                    os: data.os || 'unknown'
                };
            }

            if (timestamp > machineData[machineId].lastActivity) {
                machineData[machineId].lastActivity = timestamp;
            }

            if (data.session_id) {
                machineData[machineId].sessionCount.add(data.session_id);
            }
        });

        // License mapping
        const machines = Object.values(machineData).map(machine => {
            let licenseInfo = null;
            for (const [licenseKey, info] of Object.entries(licenseData)) {
                const hasLicense = eventsData.some(eventDoc => {
                    return eventDoc.machine_id === machine.machineId && 
                           eventDoc.details && 
                           eventDoc.details.license_key === licenseKey;
                });
                if (hasLicense) {
                    licenseInfo = {
                        customerName: info.customerName,
                        customerEmail: info.customerEmail,
                        status: info.status
                    };
                    break;
                }
            }
            
            return {
                ...machine,
                sessionCount: machine.sessionCount.size,
                licenseInfo: licenseInfo
            };
        }).sort((a, b) => b.lastActivity - a.lastActivity);

        // Ha új betöltés, tároljuk az összes gépet
        if (!isLoadMore) {
            allMachines = machines;
        }

        // ✅ 5. RENDERELÉS - csak az aktuális oldalnyi adat
        const startIndex = currentMachineListPage * MACHINES_PER_PAGE;
        const endIndex = startIndex + MACHINES_PER_PAGE;
        const pageMachines = allMachines.slice(startIndex, endIndex);
        
        // ✅ Teljesítmény optimalizálás - array használata string concat helyett
        const htmlParts = [];
        
        // Ha több betöltés, akkor megtartjuk a meglévő elemeket
        if (isLoadMore) {
            const existingItems = machineListDiv.querySelectorAll('.list-group-item');
            existingItems.forEach(item => {
                htmlParts.push(item.outerHTML);
            });
        }
        
        pageMachines.forEach(machine => {
            const lastActivityStr = machine.lastActivity.toLocaleDateString('hu-HU') + ' ' + 
                                   machine.lastActivity.toLocaleTimeString('hu-HU');
            
            const machineIdDisplay = machine.machineId ? 
                machine.machineId.substring(0, 8) + '...' : 
                'Unknown Machine';
            
            const displayName = machine.licenseInfo ? 
                `${machine.licenseInfo.customerName} (${machineIdDisplay})` : 
                machineIdDisplay;
            
            const licenseStatus = machine.licenseInfo ? 
                `<span class="badge bg-success">Licensed</span>` : 
                `<span class="badge bg-secondary">Free User</span>`;
            
            const onclickAttr = machine.machineId ? 
                `onclick="loadUserSessions('${machine.machineId}')"` : 
                'onclick="alert(\'Cannot load sessions: Machine ID is missing\')"';
            
            htmlParts.push(`
                <div class="list-group-item list-group-item-action" ${onclickAttr}>
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${displayName}</h6>
                        <small>${lastActivityStr}</small>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <small>Sessions: ${machine.sessionCount} | ${machine.os} | v${machine.appVersion}</small>
                        ${licenseStatus}
                    </div>
                    ${machine.licenseInfo ? `<small class="text-muted">${machine.licenseInfo.customerEmail}</small>` : ''}
                </div>
            `);
        });

        // ✅ 6. Load more gomb
        const hasMore = endIndex < allMachines.length;
        const loadMoreBtn = hasMore ? 
            `<div class="text-center mt-3">
                <button class="btn btn-primary" onclick="loadMoreMachines()">
                    Több betöltése (${allMachines.length - endIndex} további)
                </button>
            </div>` : '';

        // ✅ 7. STÁTUSZ INFORMÁCIÓ
        const cacheStatus = isFromCache ? 
            `<div class="alert alert-success mt-2">
                <div class="d-flex justify-content-between align-items-center">
                    <small>📦 Cached data (last 48 hours) - Showing ${startIndex + 1}-${Math.min(endIndex, allMachines.length)} of ${allMachines.length} machines</small>
                    <button class="btn btn-sm btn-outline-primary" onclick="refreshMachineList()">🔄 Refresh</button>
                </div>
            </div>` :
            `<div class="alert alert-info mt-2">
                <small>🔄 Fresh data loaded (last 48 hours) - Showing ${startIndex + 1}-${Math.min(endIndex, allMachines.length)} of ${allMachines.length} machines (cached for 60 min)</small>
            </div>`;

        // ✅ HTML összeállítás és DOM frissítés
        const machineListHTML = htmlParts.length > 0 ? htmlParts.join('') : '<div class="text-muted p-3">Nincs adat</div>';
        
        // ✅ Külön divek a jobb teljesítményért
        const machineListContainer = `
            <div class="machine-list-items">
                ${machineListHTML}
            </div>
            ${loadMoreBtn}
            ${cacheStatus}
        `;
        
        machineListDiv.innerHTML = machineListContainer;

    } catch (error) {
        console.error('Error loading machine list:', error);
        machineListDiv.innerHTML = '<div class="text-danger p-3">Hiba az adatok betöltésekor</div>';
    }
}

// ✅ Cache frissítés kényszerítése
function refreshMachineList() {
    firebaseCache.forceRefresh(firebaseCache.CACHE_KEYS.USER_EVENTS);
    firebaseCache.forceRefresh(firebaseCache.CACHE_KEYS.LICENSES);
    currentMachineListPage = 0;
    allMachines = [];
    loadMachineList();
}

// ✅ Több gép betöltése
function loadMoreMachines() {
    currentMachineListPage++;
    loadMachineList(true);
}

// Load sessions for a specific machine ID
async function loadUserSessions(machineId) {
    const sessionDetailsDiv = document.getElementById('sessionDetails');
    sessionDetailsDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Betöltés...</div>';

    try {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        // Query 1: Get ALL session_start events (minimal data)
        const sessionStartsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .where('event_name', '==', 'session_start')
            .orderBy('timestamp', 'desc')
            .get();

        // Query 2: Get detailed events for last 2 days
        const recentEventsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .where('timestamp', '>=', twoDaysAgo)
            .orderBy('timestamp', 'desc')
            .get();

        // Process all sessions from session_start events
        const allSessions = {};
        sessionStartsSnapshot.forEach(doc => {
            const data = doc.data();
            const sessionId = data.session_id;
            const timestamp = safeToDate(data.timestamp);
            
            allSessions[sessionId] = {
                sessionId,
                startTime: timestamp,
                hasDetailedData: false,
                events: [],
                duration: 0
            };
        });

        // Process detailed events for recent sessions
        const recentSessions = {};
        recentEventsSnapshot.forEach(doc => {
            const data = doc.data();
            const sessionId = data.session_id;
            const timestamp = safeToDate(data.timestamp);

            if (!recentSessions[sessionId]) {
                recentSessions[sessionId] = {
                    sessionId,
                    events: [],
                    startTime: timestamp,
                    endTime: timestamp,
                    duration: 0,
                    hasDetailedData: true
                };
            }

            recentSessions[sessionId].events.push({
                ...data,
                timestamp
            });

            // Update session time bounds
            if (timestamp < recentSessions[sessionId].startTime) {
                recentSessions[sessionId].startTime = timestamp;
            }
            if (timestamp > recentSessions[sessionId].endTime) {
                recentSessions[sessionId].endTime = timestamp;
            }
        });

        // Calculate durations for recent sessions
        Object.values(recentSessions).forEach(session => {
            session.duration = Math.round((session.endTime - session.startTime) / 1000); // seconds
            session.events.sort((a, b) => a.timestamp - b.timestamp);
        });

        // Merge data: update allSessions with detailed data where available
        Object.keys(recentSessions).forEach(sessionId => {
            if (allSessions[sessionId]) {
                allSessions[sessionId] = recentSessions[sessionId];
            } else {
                // Recent session that didn't have a session_start event
                allSessions[sessionId] = recentSessions[sessionId];
            }
        });

        // Convert to array and sort by start time
        const sessionArray = Object.values(allSessions).sort((a, b) => b.startTime - a.startTime);

        // Render sessions
        let html = `<h6>Machine ID: ${machineId}</h6>`;
        
        // Count sessions by type
        const recentSessionCount = sessionArray.filter(s => s.hasDetailedData).length;
        const olderSessionCount = sessionArray.filter(s => !s.hasDetailedData).length;
        
        const infoText = `<p class="text-muted">📊 Összesen ${sessionArray.length} session 
            (${recentSessionCount} részletes az elmúlt 2 napból, ${olderSessionCount} régebbi)</p>`;
        
        html += infoText;

        // Separate recent and older sessions
        let recentSessionsHtml = '';
        let olderSessionsHtml = '<div class="mt-3"><h6 class="text-muted">Régebbi sessionok (csak alapinfó):</h6><div class="list-group list-group-flush">';
        
        sessionArray.forEach((session, index) => {
            const startTimeStr = session.startTime.toLocaleDateString('hu-HU') + ' ' + 
                                 session.startTime.toLocaleTimeString('hu-HU');
            
            if (session.hasDetailedData) {
                // Recent session with full details
                const durationStr = formatDuration(session.duration);
                
                recentSessionsHtml += `
                    <div class="card mb-2">
                        <div class="card-body p-2">
                            <div class="d-flex justify-content-between">
                                <small><strong>Session ${index + 1}</strong></small>
                                <small>${startTimeStr}</small>
                            </div>
                            <div class="d-flex justify-content-between">
                                <small>Időtartam: ${durationStr}</small>
                                <small>Események: ${session.events.length}</small>
                            </div>
                            <div class="mt-1">
                                <button class="btn btn-sm btn-outline-primary" onclick="showSessionEvents('${session.sessionId}', '${machineId}')">
                                    Részletek
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Older session with basic info only
                olderSessionsHtml += `
                    <div class="list-group-item py-1">
                        <small class="d-flex justify-content-between">
                            <span>Session ${index + 1}</span>
                            <span class="text-muted">${startTimeStr}</span>
                        </small>
                    </div>
                `;
            }
        });
        
        olderSessionsHtml += '</div></div>';
        
        // Combine HTML
        html += recentSessionsHtml;
        if (olderSessionCount > 0) {
            html += olderSessionsHtml;
        }

        sessionDetailsDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading user sessions:', error);
        sessionDetailsDiv.innerHTML = '<div class="text-danger p-3">Hiba az adatok betöltésekor</div>';
    }
}

// Show detailed events for a session
async function showSessionEvents(sessionId, machineId) {
    const modal = new bootstrap.Modal(document.getElementById('sessionEventsModal'));
    const eventsListDiv = document.getElementById('sessionEventsList');
    
    eventsListDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border"></div> Betöltés...</div>';
    modal.show();

    try {
        // ✅ OPTIMALIZÁLÁS: Limit a session események számára (utolsó 100 esemény)
        const eventsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .where('session_id', '==', sessionId)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        const events = [];
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            events.push({
                ...data,
                timestamp: safeToDate(data.timestamp)
            });
        });
        
        // ✅ Események visszarendezése időrend szerint (DESC-ből ASC-be a megjelenítéshez)
        events.reverse();

        // Render events timeline
        let html = `<h6>Session: ${sessionId.substring(0, 8)}...</h6>`;
        html += `<p class="text-muted">Machine: ${machineId}</p>`;
        
        // ✅ Információ a limitált adatokról
        const infoText = eventsSnapshot.size >= 100 ? 
            `<div class="alert alert-warning mb-3"><small>⚠️ Showing last 100 events. Some older events may not be displayed.</small></div>` :
            `<div class="alert alert-info mb-3"><small>📊 Showing all ${events.length} events for this session.</small></div>`;
        
        html += infoText;
        html += '<div class="timeline">';

        events.forEach((event, index) => {
            const timeStr = event.timestamp.toLocaleTimeString('hu-HU');
            const eventTypeClass = getEventTypeClass(event.event_type);
            
            html += `
                <div class="timeline-item mb-3">
                    <div class="d-flex">
                        <div class="timeline-marker ${eventTypeClass}"></div>
                        <div class="timeline-content ms-3">
                            <div class="d-flex justify-content-between">
                                <strong>${event.event_name}</strong>
                                <small class="text-muted">${timeStr}</small>
                            </div>
                            <div class="text-muted">${event.event_type}</div>
                            ${event.details ? `<small class="text-secondary">${JSON.stringify(event.details, null, 2)}</small>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        eventsListDiv.innerHTML = html;

    } catch (error) {
        console.error('Error loading session events:', error);
        eventsListDiv.innerHTML = '<div class="text-danger p-3">Hiba az adatok betöltésekor</div>';
    }
}

// Helper functions
function formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

function getEventTypeClass(eventType) {
    const classes = {
        'lifecycle': 'bg-success',
        'action': 'bg-primary',
        'error': 'bg-danger',
        'barrier': 'bg-warning',
        'workflow': 'bg-info'
    };
    return classes[eventType] || 'bg-secondary';
}

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        showAdminPanel();
        // ✅ Machine list csak kérésre töltődik be - nem automatikusan
        // Load machine list on admin panel load
        // setTimeout(() => {
        //     if (document.getElementById('machineList')) {
        //         loadMachineList();
        //     }
        // }, 1000);
    }
});

// ✅ CACHE KEZELŐ FUNKCIÓK
function showCacheStatus() {
    const status = firebaseCache.getStatus();
    let html = `
        <div class="modal fade" id="cacheStatusModal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">📦 Cache Status & Management</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-sm">
                                <thead>
                                    <tr>
                                        <th>Cache Type</th>
                                        <th>Status</th>
                                        <th>Age</th>
                                        <th>Size</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
    `;

    Object.entries(status).forEach(([name, info]) => {
        const statusBadge = info.valid ? 
            '<span class="badge bg-success">Valid</span>' : 
            info.error ? '<span class="badge bg-danger">Error</span>' :
            '<span class="badge bg-secondary">Not Cached</span>';
        
        const sizeText = info.size ? `${(info.size / 1024).toFixed(1)} KB` : '-';
        const ageText = info.age || '-';
        
        html += `
            <tr>
                <td>${name.replace('_', ' ')}</td>
                <td>${statusBadge}</td>
                <td>${ageText}</td>
                <td>${sizeText}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="clearSpecificCache('${firebaseCache.CACHE_KEYS[name]}', '${name}')">
                        🗑️ Clear
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                                </tbody>
                            </table>
                        </div>
                        <div class="d-grid gap-2 mt-3">
                            <button class="btn btn-warning" onclick="clearAllCache()">
                                🧹 Clear All Cache
                            </button>
                            <button class="btn btn-info" onclick="refreshAllData()">
                                🔄 Refresh All Data
                            </button>
                        </div>
                        <div class="alert alert-info mt-3">
                            <small>
                                <strong>Cache Duration:</strong> 60 minutes<br>
                                <strong>Benefits:</strong> Faster loading, reduced Firebase reads, offline access to cached data
                            </small>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if any
    document.getElementById('cacheStatusModal')?.remove();
    
    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Show modal
    new bootstrap.Modal(document.getElementById('cacheStatusModal')).show();
}

function clearSpecificCache(cacheKey, displayName) {
    if (confirm(`Are you sure you want to clear ${displayName.replace('_', ' ')} cache?`)) {
        firebaseCache.forceRefresh(cacheKey);
        showCacheStatus(); // Refresh the modal
        console.log(`🗑️ Cleared cache: ${displayName}`);
    }
}

function clearAllCache() {
    if (confirm('Are you sure you want to clear ALL cache? This will force fresh data loading on next access.')) {
        firebaseCache.cleanup();
        showCacheStatus(); // Refresh the modal
        console.log('🧹 All cache cleared');
    }
}

function refreshAllData() {
    if (confirm('This will refresh all cached data from Firebase. Continue?')) {
        firebaseCache.cleanup();
        // Close modal
        bootstrap.Modal.getInstance(document.getElementById('cacheStatusModal')).hide();
        
        // Refresh current view
        if (document.getElementById('machineList').innerHTML.includes('machines')) {
            loadMachineList();
        }
        loadUsageStats();
        
        console.log('🔄 All data refreshed from Firebase');
    }
}

// === EVENT EXPORT FUNCTIONS ===

// Fetch all events by date range with pagination
async function fetchAllEventsByDateRange(startDate, endDate) {
    const allEvents = [];
    let lastDoc = null;
    let hasMore = true;
    const batchSize = 500;
    
    // Convert dates to Firebase timestamps
    const startTimestamp = new Date(startDate);
    startTimestamp.setHours(0, 0, 0, 0);
    const endTimestamp = new Date(endDate);
    endTimestamp.setHours(23, 59, 59, 999);
    
    console.log(`📅 Fetching events from ${startTimestamp.toLocaleDateString()} to ${endTimestamp.toLocaleDateString()}`);
    
    while (hasMore) {
        try {
            let query = db.collection('user_events')
                .where('timestamp', '>=', startTimestamp)
                .where('timestamp', '<=', endTimestamp)
                .orderBy('timestamp', 'desc')
                .limit(batchSize);
            
            if (lastDoc) {
                query = query.startAfter(lastDoc);
            }
            
            const snapshot = await query.get();
            
            if (snapshot.empty) {
                hasMore = false;
                break;
            }
            
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                allEvents.push({
                    id: doc.id,
                    ...data,
                    timestamp: safeToDate(data.timestamp)
                });
            });
            
            // Update progress
            updateExportProgress(allEvents.length);
            
            // Get last document for pagination
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
            hasMore = snapshot.docs.length === batchSize;
            
            console.log(`📊 Fetched batch: ${snapshot.docs.length} events (Total: ${allEvents.length})`);
            
        } catch (error) {
            console.error('Error fetching events batch:', error);
            throw error;
        }
    }
    
    return allEvents;
}

// Update export progress UI
function updateExportProgress(count) {
    const progressCount = document.getElementById('exportProgressCount');
    if (progressCount) {
        progressCount.textContent = count;
    }
}

// Convert events to CSV format
async function convertEventsToCSV(events) {
    // First, we need to get license information for all machines
    const machineToLicense = await getMachineLicenseMapping(events);
    
    // CSV headers
    const headers = [
        'timestamp',
        'machine_id',
        'session_id',
        'event_name',
        'event_type',
        'app_version',
        'os',
        'is_licensed',
        'customer_name',
        'customer_email',
        'license_key',
        'event_details'
    ];
    
    // Build CSV rows
    const rows = [headers.join(',')];
    
    events.forEach(event => {
        const licenseInfo = machineToLicense[event.machine_id] || {};
        
        const row = [
            event.timestamp.toISOString(),
            event.machine_id || '',
            event.session_id || '',
            event.event_name || '',
            event.event_type || '',
            event.app_version || '',
            event.os || '',
            licenseInfo.isLicensed ? 'YES' : 'NO',
            licenseInfo.customerName || '',
            licenseInfo.customerEmail || '',
            licenseInfo.licenseKey || '',
            event.details ? JSON.stringify(event.details).replace(/"/g, '""') : ''
        ];
        
        // Escape values and wrap in quotes if they contain commas or quotes
        const escapedRow = row.map(value => {
            const strValue = String(value);
            if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
                return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
        });
        
        rows.push(escapedRow.join(','));
    });
    
    return rows.join('\n');
}

// Get machine to license mapping
async function getMachineLicenseMapping(events) {
    const mapping = {};
    
    try {
        // Get all licenses
        const licensesSnapshot = await db.collection('licenses').get();
        const licenses = {};
        licensesSnapshot.forEach(doc => {
            licenses[doc.id] = doc.data();
        });
        
        // Find which machines have licenses based on events
        events.forEach(event => {
            if (!mapping[event.machine_id] && event.details && event.details.license_key) {
                const licenseKey = event.details.license_key;
                if (licenses[licenseKey]) {
                    mapping[event.machine_id] = {
                        isLicensed: true,
                        licenseKey: licenseKey,
                        customerName: licenses[licenseKey].customerName,
                        customerEmail: licenses[licenseKey].customerEmail
                    };
                }
            }
        });
        
        // Mark all other machines as unlicensed
        events.forEach(event => {
            if (!mapping[event.machine_id]) {
                mapping[event.machine_id] = {
                    isLicensed: false
                };
            }
        });
        
    } catch (error) {
        console.error('Error getting license mapping:', error);
    }
    
    return mapping;
}

// Download CSV file
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) {
        // IE 10+
        navigator.msSaveBlob(blob, filename);
    } else {
        // Other browsers
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Main export function
async function exportEventsByDateRange() {
    const startDateInput = document.getElementById('exportStartDate');
    const endDateInput = document.getElementById('exportEndDate');
    const exportButton = document.querySelector('[onclick="exportEventsByDateRange()"]');
    const exportButtonText = document.getElementById('exportButtonText');
    const exportSpinner = document.getElementById('exportSpinner');
    const exportProgress = document.getElementById('exportProgress');
    const exportStatus = document.getElementById('exportStatus');
    
    // Validate inputs
    if (!startDateInput.value || !endDateInput.value) {
        showExportStatus('Kérjük, válassza ki a kezdő és befejező dátumot!', 'danger');
        return;
    }
    
    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    
    if (startDate > endDate) {
        showExportStatus('A kezdő dátum nem lehet későbbi, mint a befejező dátum!', 'danger');
        return;
    }
    
    // Disable button and show spinner
    exportButton.disabled = true;
    exportButtonText.textContent = 'Exportálás...';
    exportSpinner.classList.remove('d-none');
    exportProgress.classList.remove('d-none');
    exportStatus.classList.add('d-none');
    
    try {
        // Fetch all events
        const events = await fetchAllEventsByDateRange(startDateInput.value, endDateInput.value);
        
        if (events.length === 0) {
            showExportStatus('Nincs esemény a megadott időszakban.', 'warning');
            return;
        }
        
        // Update progress text
        document.getElementById('exportProgressText').textContent = 'CSV generálása...';
        
        // Convert to CSV
        const csvContent = await convertEventsToCSV(events);
        
        // Generate filename
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];
        const filename = `irriplanner_events_${startStr}_to_${endStr}.csv`;
        
        // Download file
        downloadCSV(csvContent, filename);
        
        showExportStatus(`Sikeres export! ${events.length} esemény exportálva.`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showExportStatus(`Hiba történt az exportálás során: ${error.message}`, 'danger');
    } finally {
        // Reset button state
        exportButton.disabled = false;
        exportButtonText.textContent = 'Export CSV';
        exportSpinner.classList.add('d-none');
        exportProgress.classList.add('d-none');
    }
}

// Show export status message
function showExportStatus(message, type) {
    const exportStatus = document.getElementById('exportStatus');
    exportStatus.textContent = message;
    exportStatus.className = `alert alert-${type}`;
    exportStatus.classList.remove('d-none');
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            exportStatus.classList.add('d-none');
        }, 5000);
    }
}