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

    if (!customerName || !customerEmail || !months) {
        alert('Please fill all fields');
        return;
    }

    const licenseKey = generateLicenseKey();
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + months);

    try {
        await db.collection('licenses').doc(licenseKey).set({
            customerName,
            customerEmail,
            status: 'active',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            expiresAt: expiryDate,
            activatedBy: null,
            lastUsed: null
        });

        alert(`License generated: ${licenseKey}`);
        loadLicenses();
    } catch (error) {
        alert('Error generating license: ' + error.message);
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

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        showAdminPanel();
    }
});