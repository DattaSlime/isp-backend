const admin = require('firebase-admin');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./firebase-key.json');

// Inicializamos Firebase de forma moderna e inmune al error de "undefined"
initializeApp({
  credential: cert(serviceAccount)
});

// Instanciamos Cloud Firestore utilizando su inicializador directo
const db = getFirestore();

console.log('✅ Conexión exitosa a Cloud Firestore en la nube');

// Exportamos la base de datos para usarla en server.js
module.exports = db;