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
    loadMachineUsageStats();
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

// Load machine usage statistics for the last 7 days
async function loadMachineUsageStats() {
    // Get date range (last 7 days)
    const dates = getLast7Days();
    const machineStatsDiv = document.getElementById('machineUsageStats');
    
    // Clear previous data
    machineStatsDiv.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
    
    try {
        // Track all unique machines
        let allUniqueMachines = new Set();
        let uniqueMachinesByDay = {};
        let uniqueMachinesByLicense = {};
        
        // Load data for each day
        const promises = dates.map(async (date) => {
            const docRef = db.collection('machine_usage').doc(date);
            const docSnap = await docRef.get();
            
            if (docSnap.exists) {
                const data = docSnap.data();
                uniqueMachinesByDay[date] = new Set();
                
                // Process each license's machine IDs
                for (const [licenseKey, machineIds] of Object.entries(data)) {
                    if (licenseKey === 'timestamp') continue;
                    
                    // Initialize license tracker if not exists
                    if (!uniqueMachinesByLicense[licenseKey]) {
                        uniqueMachinesByLicense[licenseKey] = new Set();
                    }
                    
                    // Add machine IDs to sets
                    machineIds.forEach(machineId => {
                        allUniqueMachines.add(machineId);
                        uniqueMachinesByDay[date].add(machineId);
                        uniqueMachinesByLicense[licenseKey].add(machineId);
                    });
                }
            } else {
                uniqueMachinesByDay[date] = new Set(); // Empty set for days with no data
            }
        });
        
        // Wait for all promises to resolve
        await Promise.all(promises);
        
        // Prepare chart data
        const chartLabels = dates.map(date => formatDate(date, true));
        const chartData = dates.map(date => uniqueMachinesByDay[date].size);
        
        // Build the HTML for the statistics
        let statsHTML = `
            <div class="card p-3 mb-3">
                <h4>Összesítés (elmúlt 7 nap)</h4>
                <p>Összes egyedi számítógép: <strong>${allUniqueMachines.size}</strong></p>
            </div>
            
            <div class="card p-3 mb-3">
                <h4>Napi használat</h4>
                <canvas id="dailyUsageChart" width="400" height="200"></canvas>
            </div>
            
            <div class="card p-3 mb-3">
                <h4>Napi bontás</h4>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Dátum</th>
                                <th>Egyedi számítógépek</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        dates.forEach(date => {
            statsHTML += `
                <tr>
                    <td>${formatDate(date)}</td>
                    <td>${uniqueMachinesByDay[date].size}</td>
                </tr>
            `;
        });
        
        statsHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div class="card p-3">
                <h4>Licenszek szerinti bontás</h4>
                <div class="table-responsive">
                    <table class="table table-striped">
                        <thead>
                            <tr>
                                <th>Licensz kulcs</th>
                                <th>Egyedi számítógépek</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Add unlicensed users first with highlighting if they exist
        if (uniqueMachinesByLicense['unlicensed']) {
            const unlicensedCount = uniqueMachinesByLicense['unlicensed'].size;
            statsHTML += `
                <tr class="table-warning">
                    <td><strong>Nem licenszelt felhasználók</strong></td>
                    <td>${unlicensedCount}</td>
                </tr>
            `;
        }
        
        // Then add all other license keys
        for (const [licenseKey, machines] of Object.entries(uniqueMachinesByLicense)) {
            // Skip unlicensed as we already added it
            if (licenseKey === 'unlicensed') continue;
            
            statsHTML += `
                <tr>
                    <td>${licenseKey}</td>
                    <td>${machines.size}</td>
                </tr>
            `;
        }
        
        statsHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        machineStatsDiv.innerHTML = statsHTML;
        
        // Create chart
        createDailyUsageChart(chartLabels, chartData);
        
    } catch (error) {
        console.error('Error loading machine usage stats:', error);
        machineStatsDiv.innerHTML = `<div class="alert alert-danger">Hiba a statisztikák betöltésekor: ${error.message}</div>`;
    }
}

// Function to create the daily usage chart
function createDailyUsageChart(labels, data) {
    const ctx = document.getElementById('dailyUsageChart');
    
    // Check if chart instance already exists and destroy it
    if (window.dailyChart) {
        window.dailyChart.destroy();
    }
    
    // Create new chart
    window.dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Napi egyedi számítógépek',
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Helper function to get dates for the last 7 days
function getLast7Days() {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]); // Format: YYYY-MM-DD
    }
    return dates.reverse(); // Reverse to show oldest to newest
}

// Helper function to format dates for display
function formatDate(dateString, short = false) {
    if (short) {
        const options = { month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('hu-HU', options);
    }
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('hu-HU', options);
}

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        showAdminPanel();
    }
});