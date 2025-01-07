const auth = firebase.auth();
const db = firebase.firestore();

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
            activatedBy: null
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
    const licensesTable = document.getElementById('licenseList');
    licensesTable.innerHTML = '';

    try {
        const snapshot = await db.collection('licenses').get();
        snapshot.forEach(doc => {
            const license = doc.data();
            const row = `
                <tr>
                    <td>${doc.id}</td>
                    <td>${license.customerName}</td>
                    <td>${license.status}</td>
                    <td>${license.expiresAt.toDate().toLocaleDateString()}</td>
                    <td>
                        <button onclick="revokeLicense('${doc.id}')" class="btn btn-sm btn-danger">Revoke</button>
                    </td>
                </tr>
            `;
            licensesTable.innerHTML += row;
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

// Check auth state
auth.onAuthStateChanged(user => {
    if (user) {
        showAdminPanel();
    }
});