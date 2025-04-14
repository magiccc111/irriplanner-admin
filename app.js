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
async function showAdminPanel() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    await loadLicenses();
    await loadAndDisplayCurrentVersion();
    await updateStatistics();
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
        await updateStatistics();
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
            await updateStatistics();
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
            await updateStatistics();
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

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        showAdminPanel();
    }
});

// Chart.js script betöltése
const chartScript = document.createElement('script');
chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(chartScript);

let licenseChart;
let userTypeChart;

async function updateStatistics() {
    const licensesSnapshot = await db.collection('licenses').get();
    const usageSnapshot = await db.collection('usage_stats').get();
    const now = new Date();
    
    let totalLicenses = 0;
    let activeLicenses = 0;
    let expiredLicenses = 0;
    let unlicensedUsers = 0;
    
    // Count licensed users
    licensesSnapshot.forEach(doc => {
        const license = doc.data();
        totalLicenses++;
        
        const expirationDate = new Date(license.expiresAt);
        if (expirationDate > now && license.status === 'active') {
            activeLicenses++;
        } else {
            expiredLicenses++;
        }
    });
    
    // Count unlicensed users from usage stats
    usageSnapshot.forEach(doc => {
        const usage = doc.data();
        if (!usage.licenseKey) {
            unlicensedUsers++;
        }
    });
    
    // Update statistics display
    document.getElementById('totalLicenses').textContent = totalLicenses;
    document.getElementById('activeLicenses').textContent = activeLicenses;
    document.getElementById('expiredLicenses').textContent = expiredLicenses;
    document.getElementById('unlicensedUsers').textContent = unlicensedUsers;
    
    // Update charts
    updateLicenseChart(activeLicenses, expiredLicenses);
    updateUserTypeChart(activeLicenses, unlicensedUsers);
}

function updateLicenseChart(active, expired) {
    const ctx = document.getElementById('licenseChart').getContext('2d');
    
    if (licenseChart) {
        licenseChart.destroy();
    }
    
    licenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Aktív Licenszek', 'Lejárt Licenszek'],
            datasets: [{
                data: [active, expired],
                backgroundColor: ['#28a745', '#dc3545']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Licenszek Megoszlása'
                }
            }
        }
    });
}

function updateUserTypeChart(licensed, unlicensed) {
    const ctx = document.getElementById('userTypeChart').getContext('2d');
    
    if (userTypeChart) {
        userTypeChart.destroy();
    }
    
    userTypeChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Licenszelt Felhasználók', 'Nem Licenszelt Felhasználók'],
            datasets: [{
                data: [licensed, unlicensed],
                backgroundColor: ['#28a745', '#ffc107']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Felhasználók Megoszlása'
                }
            }
        }
    });
}