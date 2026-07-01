const express = require('express');
const cors = require('cors'); // <-- Habilita comunicación con Ionic sin bloqueos
const sql = require('mssql');

// ========================================================
// NUEVA CONFIGURACIÓN: INICIALIZAR FIREBASE EN LA NUBE
// ========================================================
const db = require('./firebase'); 

const app = express();
app.use(cors()); 
app.use(express.json());

// ========================================================
// CONFIGURACIÓN DE CONEXIÓN A TU SQL SERVER (LOCAL)
// ========================================================
const dbConfig = {
    user: 'sa',             
    password: '123456',         
    server: 'localhost',  
    database: 'ISP_PERU', 
    options: {
        encrypt: false,
        trustServerCertificate: true 
    }
};

// Verificación global de SQL Server
sql.connect(dbConfig).then(pool => {
    if (pool.connected) {
        console.log('✅ Conectado exitosamente a SQL Server Management Studio');
    }
}).catch(err => {
    console.error('❌ Error fatal al conectar con tu Base de Datos Local:', err.message);
});

// ========================================================
// 1. LOGIN DE USUARIOS (Migrado a Firebase en la Nube ☁️)
// ========================================================
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    
    // 🚨 ESTA LÍNEA NOS DIRÁ EN LA CONSOLA QUÉ RECIBE EL BACKEND:
    console.log(`Intentando login con Correo: [${correo}] y Password: [${password}]`);

    try {
        const usuariosRef = db.collection('usuarios');
        const snapshot = await usuariosRef
            .where('correo', '==', correo)
            .where('password', '==', password)
            .get();

        if (snapshot.empty) {
            console.log('❌ No se encontró ningún usuario con esas credenciales en Firestore.');
            return res.status(401).json({ success: false, mensaje: 'Correo o contraseña incorrectos' });
        }

        let usuarioData = {};
        snapshot.forEach(doc => {
            usuarioData = { id_firestore: doc.id, ...doc.data() };
        });

        console.log('✅ Usuario encontrado con éxito:', usuarioData.nombre_completo);

        res.json({ 
            success: true, 
            usuario: {
                usuario_id: Number(usuarioData.usuario_id), // Lo aseguramos como número
                nombre_completo: usuarioData.nombre_completo,
                correo: usuarioData.correo,
                rol: usuarioData.rol,
                codigo_empleado: usuarioData.codigo_empleado
            } 
        });

    } catch (err) {
        console.error("Error en Login Firestore:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 2. OBTENER TODAS LAS ÁREAS (Migrado a Firebase ☁️)
// ========================================================
app.get('/api/areas', async (req, res) => {
    try {
        const areasRef = db.collection('areas');
        const snapshot = await areasRef.get();

        if (snapshot.empty) {
            return res.json([]); // Si no hay áreas en la nube, devolvemos un arreglo vacío
        }

        const areasLista = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            areasLista.push({
                area_id: Number(data.area_id), // Mantenemos "area_id" como número para no romper tu Ionic
                nombre_area: data.nombre_area,
                ubicacion_planta: data.ubicacion_planta
            });
        });

        // Enviamos la lista de áreas extraídas directamente desde Firebase
        res.json(areasLista);

    } catch (err) {
        console.error("Error al obtener áreas de Firestore:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 3. REGISTRAR INCIDENCIA (Migrado a Firebase ☁️)
// ========================================================
app.post('/api/incidentes', async (req, res) => {
    const { usuario_id, area_id, tipo, titulo, descripcion, foto_evidencia } = req.body;
    try {
        const incidentesRef = db.collection('incidentes');
        
        // Creamos el nuevo documento con los datos que vienen de Ionic
        const nuevaIncidencia = {
            usuario_id: Number(usuario_id), // Aseguramos que los IDs vayan como números
            area_id: Number(area_id),
            tipo: tipo,
            titulo: titulo,
            descripcion: descripcion,
            foto_evidencia: foto_evidencia || '', // Si no hay foto, guardamos cadena vacía
            estado: 'Pendiente',                 // Estado inicial por defecto
            fecha_reporte: new Date().toISOString() // Fecha y hora exacta del reporte
        };

        // Guardamos en Firestore usando .add() para que genere un ID automático
        const docRef = await incidentesRef.add(nuevaIncidencia);
        
        console.log(`✅ Incidente creado en la nube con ID: ${docRef.id}`);
        res.status(201).json({ success: true, mensaje: '¡Incidente guardado en Cloud Firestore!' });

    } catch (err) {
        console.error("Error al registrar incidente en Firestore:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 4. LEER EL HISTORIAL DE INCIDENTES (Migrado a Firebase ☁️)
// ========================================================
app.get('/api/incidentes', async (req, res) => {
    try {
        const incidentesRef = db.collection('incidentes');
        // Ordenamos por fecha de reporte descendente (más nuevos primero)
        const snapshot = await incidentesRef.orderBy('fecha_reporte', 'desc').get();

        if (snapshot.empty) {
            return res.json([]); // Si no hay incidentes, devolvemos un arreglo vacío
        }

        const incidentesLista = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            incidentesLista.push({
                incidente_id: doc.id, // Usamos el ID automático de Firestore como identificador único
                tipo: data.tipo,
                titulo: data.titulo,
                descripcion: data.descripcion,
                foto_evidencia: data.foto_evidencia,
                estado: data.estado || 'Pendiente',
                fecha_reporte: data.fecha_reporte,
                // Como es No Relacional, enviamos cadenas informativas o mapeos simples si tu Ionic los renderiza
                reportado_por: `Usuario ID: ${data.usuario_id}`, 
                area_nombre: `Área ID: ${data.area_id}`
            });
        });

        res.json(incidentesLista);

    } catch (err) {
        console.error("Error al leer historial de incidentes en Firestore:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 5. GUARDAR CHECKLIST DIARIO OBLIGATORIO (Migrado a Firebase ☁️)
// ========================================================
app.post('/api/checklist', async (req, res) => {
    const { usuario_id, cumple_epp, herramientas_optimas, condicion_salud, observaciones } = req.body;
    try {
        const checklistRef = db.collection('checklist_diario');
        
        // Estructuramos el documento No Relacional para Firestore
        const nuevoChecklist = {
            usuario_id: Number(usuario_id), 
            cumple_epp: Boolean(cumple_epp), // Convertimos a true/false puro
            herramientas_optimas: Boolean(herramientas_optimas),
            condicion_salud: condicion_salud,
            observaciones: observaciones || '',
            fecha_completado: new Date().toISOString() // Captura marca de tiempo exacta
        };

        // Guardamos en la nube con ID automático de Google
        const docRef = await checklistRef.add(nuevoChecklist);
        
        console.log(`✅ Checklist diario guardado en la nube con ID: ${docRef.id}`);
        res.status(201).json({ success: true, mensaje: '¡Checklist diario guardado con éxito en Cloud Firestore!' });

    } catch (err) {
        console.error("❌ Error al guardar checklist en Firestore:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// INICIAR EL SERVIDOR (Manteniendo tu estructura original)
// ========================================================
app.listen(3000, () => {
    console.log('🚀 API de ISP PERU corriendo en http://localhost:3000');
});