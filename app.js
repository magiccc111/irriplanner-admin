// EmailJS inicializálása
(function() {
    // Ellenőrizzük, hogy a konfiguráció be van-e töltve
    if (typeof EMAILJS_CONFIG !== 'undefined' && EMAILJS_CONFIG.PUBLIC_KEY !== 'your_public_key') {
        emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
    } else {
        console.warn('EmailJS konfiguráció hiányzik vagy nem megfelelő. Kérjük, állítsa be az emailjs-config.js fájlban.');
    }
})();

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
        // Get current date and date 7 days ago
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        
        // Query usage stats from the last 7 days
        const snapshot = await db.collection('usage_stats')
            .where('timestamp', '>=', sevenDaysAgo)
            .get();

        // Get today's start timestamp
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        // Process the data
        const uniqueMachines = new Set();
        const licensedMachines = new Set();
        const freeMachines = new Set();
        const todayActiveMachines = new Set();

        snapshot.forEach(doc => {
            const data = doc.data();
            const machineId = data.machineId;
            const timestamp = data.timestamp.toDate();

            // Add to unique machines
            uniqueMachines.add(machineId);

            // Add to licensed or free machines
            if (data.isLicensed) {
                licensedMachines.add(machineId);
            } else {
                freeMachines.add(machineId);
            }

            // Check if used today
            if (timestamp >= todayStart) {
                todayActiveMachines.add(machineId);
            }
        });

        // Update the display
        document.getElementById('totalUniqueUsers').textContent = uniqueMachines.size;
        document.getElementById('licensedUsers').textContent = licensedMachines.size;
        document.getElementById('freeUsers').textContent = freeMachines.size;
        document.getElementById('todayActiveUsers').textContent = todayActiveMachines.size;

    } catch (error) {
        console.error('Error loading usage stats:', error);
        alert('Error loading usage statistics: ' + error.message);
    }
}

// Refresh usage statistics
function refreshUsageStats() {
    loadUsageStats();
}

// === ANALYTICS FUNCTIONS ===

// Load machine list with user information
async function loadMachineList() {
    const machineListDiv = document.getElementById('machineList');
    machineListDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Betöltés...</div>';

    try {
        // Get all user events to find unique machine IDs
        const eventsSnapshot = await db.collection('user_events').get();
        const machineData = {};

        // Collect machine IDs and their latest activity
        eventsSnapshot.forEach(doc => {
            const data = doc.data();
            const machineId = data.machine_id;
            const timestamp = data.timestamp?.toDate?.() || new Date(data.timestamp);

            if (!machineData[machineId]) {
                machineData[machineId] = {
                    machineId,
                    lastActivity: timestamp,
                    sessionCount: new Set(),
                    appVersion: data.app_version || 'unknown',
                    os: data.os || 'unknown'
                };
            }

            // Update last activity if this event is newer
            if (timestamp > machineData[machineId].lastActivity) {
                machineData[machineId].lastActivity = timestamp;
            }

            // Track unique sessions
            if (data.session_id) {
                machineData[machineId].sessionCount.add(data.session_id);
            }
        });

        // Get license information
        const licensesSnapshot = await db.collection('licenses').get();
        const licenseMap = {};

        licensesSnapshot.forEach(doc => {
            const license = doc.data();
            // We'll need to match this with machine IDs somehow
            // For now, we'll show machine IDs without names unless there's a direct match
        });

        // Convert to array and sort by last activity
        const machines = Object.values(machineData).map(machine => ({
            ...machine,
            sessionCount: machine.sessionCount.size
        })).sort((a, b) => b.lastActivity - a.lastActivity);

        // Render machine list
        let html = '';
        machines.forEach(machine => {
            const lastActivityStr = machine.lastActivity.toLocaleDateString('hu-HU') + ' ' + 
                                   machine.lastActivity.toLocaleTimeString('hu-HU');
            
            html += `
                <div class="list-group-item list-group-item-action" onclick="loadUserSessions('${machine.machineId}')">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${machine.machineId.substring(0, 8)}...</h6>
                        <small>${lastActivityStr}</small>
                    </div>
                    <p class="mb-1">Sessions: ${machine.sessionCount} | ${machine.os} | v${machine.appVersion}</p>
                </div>
            `;
        });

        machineListDiv.innerHTML = html || '<div class="text-muted p-3">Nincs adat</div>';

    } catch (error) {
        console.error('Error loading machine list:', error);
        machineListDiv.innerHTML = '<div class="text-danger p-3">Hiba az adatok betöltésekor</div>';
    }
}

// Load sessions for a specific machine ID
async function loadUserSessions(machineId) {
    const sessionDetailsDiv = document.getElementById('sessionDetails');
    sessionDetailsDiv.innerHTML = '<div class="text-center p-3"><div class="spinner-border spinner-border-sm"></div> Betöltés...</div>';

    try {
        // Get all events for this machine ID
        const eventsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .orderBy('timestamp', 'desc')
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
        html += `<p class="text-muted">Összes session: ${sessionArray.length}</p>`;

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
        // Get all events for this session
        const eventsSnapshot = await db.collection('user_events')
            .where('machine_id', '==', machineId)
            .where('session_id', '==', sessionId)
            .orderBy('timestamp', 'asc')
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
        // Load machine list on admin panel load
        setTimeout(() => {
            if (document.getElementById('machineList')) {
                loadMachineList();
            }
        }, 1000);
    }
});