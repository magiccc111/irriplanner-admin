// EmailJS inicializálása
(function() {
    // Ellenőrizzük, hogy a konfiguráció be van-e töltve
    if (typeof EMAILJS_CONFIG !== 'undefined' && EMAILJS_CONFIG.PUBLIC_KEY !== 'your_public_key') {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    } else {
        console.warn('EmailJS konfiguráció hiányzik vagy nem megfelelő. Kérjük, állítsa be az emailjs-config.js fájlban.');
    }
})();

// ✅ CACHE KEZELŐ RENDSZER
class FirebaseCache {
    constructor() {
        this.CACHE_DURATION = 30 * 60 * 1000; // 30 perc milliszekundumban
        this.CACHE_KEYS = {
            USER_EVENTS: 'firebase_cache_user_events',
            USAGE_STATS: 'firebase_cache_usage_stats',
            LICENSES: 'firebase_cache_licenses'
        };
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
    loadLicenses();
    loadAndDisplayCurrentVersion();
    loadUsageStats(); // Load usage statistics
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
                timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
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
            console.log(`🔄 Fresh usage stats loaded: ${usageData.length} records (cached for 30 min)`);
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

// Load machine list with user information
async function loadMachineList() {
    const machineListDiv = document.getElementById('machineList');
    machineListDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Betöltés...</div>';

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
        } else {
            // ✅ 2. FIREBASE LEKÉRÉS - ÖSSZES ADAT (nem limitált!)
            console.log('🔄 Loading fresh data from Firebase...');
            
            // User events betöltése - ÖSSZES adat
            const eventsSnapshot = await db.collection('user_events')
                .orderBy('timestamp', 'desc')
                .get();
            
            // Licenses betöltése
            const licensesSnapshot = await db.collection('licenses').get();

            // Adatok cache-elése
            eventsData = eventsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate?.() || new Date(doc.data().timestamp)
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

        // ✅ 5. RENDERELÉS
        let html = '';
        machines.forEach(machine => {
            const lastActivityStr = machine.lastActivity.toLocaleDateString('hu-HU') + ' ' + 
                                   machine.lastActivity.toLocaleTimeString('hu-HU');
            
            const displayName = machine.licenseInfo ? 
                `${machine.licenseInfo.customerName} (${machine.machineId.substring(0, 8)}...)` : 
                `${machine.machineId.substring(0, 8)}...`;
            
            const licenseStatus = machine.licenseInfo ? 
                `<span class="badge bg-success">Licensed</span>` : 
                `<span class="badge bg-secondary">Free User</span>`;
            
            html += `
                <div class="list-group-item list-group-item-action" onclick="loadUserSessions('${machine.machineId}')">
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
            `;
        });

        // ✅ 6. STÁTUSZ INFORMÁCIÓ
        const cacheStatus = isFromCache ? 
            `<div class="alert alert-success mt-2">
                <div class="d-flex justify-content-between align-items-center">
                    <small>📦 Cached data - ${machines.length} machines, ${eventsData.length} events</small>
                    <button class="btn btn-sm btn-outline-primary" onclick="refreshMachineList()">🔄 Refresh</button>
                </div>
            </div>` :
            `<div class="alert alert-info mt-2">
                <small>🔄 Fresh data loaded - ${machines.length} machines, ${eventsData.length} events (cached for 30 min)</small>
            </div>`;

        machineListDiv.innerHTML = (html || '<div class="text-muted p-3">Nincs adat</div>') + cacheStatus;

    } catch (error) {
        console.error('Error loading machine list:', error);
        machineListDiv.innerHTML = '<div class="text-danger p-3">Hiba az adatok betöltésekor</div>';
    }
}

// ✅ Cache frissítés kényszerítése
function refreshMachineList() {
    firebaseCache.forceRefresh(firebaseCache.CACHE_KEYS.USER_EVENTS);
    firebaseCache.forceRefresh(firebaseCache.CACHE_KEYS.LICENSES);
    loadMachineList();
}

// Load sessions for a specific machine ID
async function loadUserSessions(machineId) {
    const sessionDetailsDiv = document.getElementById('sessionDetails');
    sessionDetailsDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Betöltés...</div>';

    try {
        // ✅ OPTIMALIZÁLÁS: Limit az események számára (legfrissebb 1000 esemény)
        const eventsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .orderBy('timestamp', 'desc')
            .limit(1000)
            .get();

        const sessions = {};

        // Group events by session ID
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            const sessionId = data.session_id;
            const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);

            if (!sessions[sessionId]) {
                sessions[sessionId] = {
                    sessionId,
                    events: [],
                    startTime: timestamp,
                    endTime: timestamp,
                    duration: 0
                };
            }

            sessions[sessionId].events.push({
                ...data,
                timestamp
            });

            // Update session time bounds
            if (timestamp < sessions[sessionId].startTime) {
                sessions[sessionId].startTime = timestamp;
            }
            if (timestamp > sessions[sessionId].endTime) {
                sessions[sessionId].endTime = timestamp;
            }
        });

        // Calculate durations and sort events within sessions
        Object.values(sessions).forEach(session => {
            session.duration = Math.round((session.endTime - session.startTime) / 1000); // seconds
            session.events.sort((a, b) => a.timestamp - b.timestamp);
        });

        // Convert to array and sort by start time
        const sessionArray = Object.values(sessions).sort((a, b) => b.startTime - a.startTime);

        // Render sessions
        let html = `<h6>Machine ID: ${machineId}</h6>`;
        
        // ✅ Információ a limitált adatokról
        const infoText = eventsSnapshot.size >= 1000 ? 
            `<p class="text-muted">📊 Showing ${sessionArray.length} sessions from last 1000 events. Some older sessions may not be shown.</p>` :
            `<p class="text-muted">📊 Showing all ${sessionArray.length} sessions for this machine.</p>`;
        
        html += infoText;

        sessionArray.forEach((session, index) => {
            const startTimeStr = session.startTime.toLocaleDateString('hu-HU') + ' ' + 
                                 session.startTime.toLocaleTimeString('hu-HU');
            const durationStr = formatDuration(session.duration);
            
            // Get key events summary
            const keyEvents = session.events.filter(e => 
                ['session_start', 'session_end', 'polygon_created', 'sprinkler_type_selected', 'button_click'].includes(e.event_name)
            );

            html += `
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
        });

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
        // ✅ OPTIMALIZÁLÁS: Limit a session események számára (legfrissebb 500 esemény)
        const eventsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .where('session_id', '==', sessionId)
            .orderBy('timestamp', 'asc')
            .limit(500)
            .get();

        const events = [];
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            events.push({
                ...data,
                timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp)
            });
        });

        // Render events timeline
        let html = `<h6>Session: ${sessionId.substring(0, 8)}...</h6>`;
        html += `<p class="text-muted">Machine: ${machineId}</p>`;
        
        // ✅ Információ a limitált adatokról
        const infoText = eventsSnapshot.size >= 500 ? 
            `<div class="alert alert-warning mb-3"><small>⚠️ Showing first 500 events. Some events may not be displayed.</small></div>` :
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
                                <strong>Cache Duration:</strong> 30 minutes<br>
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