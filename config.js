// Initialize Firebase
const app = firebase.initializeApp({
  apiKey: "AIzaSyAOhxAyZOePIzbGzwWNOTcwVxpRkwUMNYE",
  authDomain: "irriplanner-license.firebaseapp.com",
  projectId: "irriplanner-license",
  storageBucket: "irriplanner-license.firebasestorage.app",
  messagingSenderId: "51987385490",
  appId: "1:51987385490:web:9122ce2470178f4bed6a4b"
});

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();