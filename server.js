const express = require('express');
const cors = require('cors'); // <-- Habilita comunicación con Ionic sin bloqueos
const sql = require('mssql');

const app = express();
app.use(cors()); 
app.use(express.json());

// ========================================================
// CONFIGURACIÓN DE CONEXIÓN A TU SQL SERVER
// ========================================================
const dbConfig = {
    user: 'sa',             // Si usas Autenticación de Windows déjalo vacío ''
    password: '123456',         // SSi usas Autenticación de Windows déjalo vacío ''
    server: 'localhost',  // Tu servidor local
    database: 'ISP_PERU', // 🚨 Si en tu SSMS se llama ISP_SST, cámbialo aquí a ISP_SST
    options: {
        encrypt: false,
        trustServerCertificate: true // Crucial para desarrollo local
    }
};

// ========================================================
// VERIFICACIÓN GLOBAL DE CONEXIÓN (Muestra el estado en consola)
// ========================================================
sql.connect(dbConfig).then(pool => {
    if (pool.connected) {
        console.log('✅ Conectado exitosamente a SQL Server Management Studio');
    }
}).catch(err => {
    console.error('❌ Error fatal al conectar con tu Base de Datos:', err.message);
});

// ========================================================
// 1. LOGIN DE USUARIOS (Supervisor y Trabajador)
// ========================================================
app.post('/api/login', async (req, res) => {
    const { correo, password } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request()
            .input('correo', sql.VarChar, correo)
            .input('password', sql.VarChar, password)
            .query('SELECT usuario_id, nombre_completo, correo, rol, codigo_empleado FROM Usuarios WHERE correo = @correo AND password = @password');
        
        if (result.recordset.length > 0) {
            res.json({ success: true, usuario: result.recordset[0] });
        } else {
            res.status(401).json({ success: false, mensaje: 'Correo o contraseña incorrectos' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 2. OBTENER TODAS LAS ÁREAS (Para cargarlas en tu formulario)
// ========================================================
app.get('/api/areas', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query('SELECT * FROM Areas');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 3. REGISTRAR INCIDENCIA (Ordinaria o Crítica)
// ========================================================
app.post('/api/incidentes', async (req, res) => {
    const { usuario_id, area_id, tipo, titulo, descripcion, foto_evidencia } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .input('area_id', sql.Int, area_id)
            .input('tipo', sql.VarChar, tipo)
            .input('titulo', sql.VarChar, titulo)
            .input('descripcion', sql.Text, descripcion)
            .input('foto_evidencia', sql.VarChar, foto_evidencia)
            .query(`INSERT INTO Incidentes (usuario_id, area_id, tipo, titulo, descripcion, foto_evidencia) 
                    VALUES (@usuario_id, @area_id, @tipo, @titulo, @descripcion, @foto_evidencia)`);
        
        res.status(201).json({ success: true, mensaje: '¡Incidente guardado en SQL Server!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 4. LEER EL HISTORIAL DE INCIDENTES (Para el Supervisor)
// ========================================================
app.get('/api/incidentes', async (req, res) => {
    try {
        let pool = await sql.connect(dbConfig);
        let result = await pool.request().query(`
            SELECT I.incidente_id, I.tipo, I.titulo, I.descripcion, I.foto_evidencia, I.estado, I.fecha_reporte,
                   U.nombre_completo AS reportado_por, A.nombre_area AS area_nombre
            FROM Incidentes I
            JOIN Usuarios U ON I.usuario_id = U.usuario_id
            JOIN Areas A ON I.area_id = A.area_id
            ORDER BY I.incidente_id DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================================================
// 5. GUARDAR CHECKLIST DIARIO OBLIGATORIO
// ========================================================
app.post('/api/checklist', async (req, res) => {
    const { usuario_id, cumple_epp, herramientas_optimas, condicion_salud, observaciones } = req.body;
    try {
        let pool = await sql.connect(dbConfig);
        await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .input('cumple_epp', sql.Bit, cumple_epp)
            .input('herramientas_optimas', sql.Bit, herramientas_optimas)
            .input('condicion_salud', sql.VarChar, condicion_salud)
            .input('observaciones', sql.Text, observaciones)
            .query(`INSERT INTO Checklist_Diario (usuario_id, cumple_epp, herramientas_optimas, condicion_salud, observaciones) 
                    VALUES (@usuario_id, @cumple_epp, @herramientas_optimas, @condicion_salud, @observaciones)`);
        
        res.status(201).json({ success: true, mensaje: 'Checklist guardado en SQL Server.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Iniciar el Servidor en el Puerto 3000
app.listen(3000, () => {
    console.log('🚀 API de ISP PERU corriendo en http://localhost:3000');
});