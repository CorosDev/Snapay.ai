/**
 * Servidor Express que actúa como proxy seguro hacia Brevo CRM.
 * Recibe datos del formulario del frontend en /api/leads
 * y los reenvía a la API de Brevo usando la clave de API (guardada en servidor).
 */

require('dotenv').config(); // Carga variables desde .env
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

// Inicializar app Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json()); // Parsea JSON en requests
app.use(cors()); // Habilita CORS para que el frontend pueda hacer requests

// Variables de configuración Brevo
const BREVO_API_KEY = process.env.BREVO_API_KEY; // Lee la clave desde variables de entorno
const BREVO_API_URL = 'https://api.brevo.com/v3/contacts'; // Endpoint de contactos Brevo
const SNAPAY_LIST_ID = parseInt(process.env.SNAPAY_LIST_ID || '12345', 10); // Reemplaza 12345 por el ID real de lista Snapay

/**
 * POST /api/leads
 * Recibe los datos del formulario y los envía a Brevo.
 * Body esperado: { NOMBRE, EMAIL, SMS, MULT_SLCT, MESSAGE, LIST_ID }
 */
app.post('/api/leads', async (req, res) => {
  // Validar que la clave de API esté configurada
  if (!BREVO_API_KEY) {
    return res.status(500).json({
      error: 'BREVO_API_KEY no está configurada en el servidor.',
      details: 'Por favor, configura la variable de entorno BREVO_API_KEY en el archivo .env'
    });
  }

  // Extraer campos del body del request
  const { NOMBRE, EMAIL, SMS, MULT_SLCT, MESSAGE, LIST_ID } = req.body;

  const listId = LIST_ID ? parseInt(LIST_ID, 10) : SNAPAY_LIST_ID;

  console.log('📝 Datos recibidos del formulario:', { NOMBRE, EMAIL, SMS, MULT_SLCT, MESSAGE, LIST_ID, listId });

  // Mapear ID numérico a string exacto para Brevo (opciones múltiples)
  let brevoTextOption = "";
  const selectedId = String(MULT_SLCT).trim();

  if (selectedId === "1") {
    brevoTextOption = "Tester de Acceso Anticipado / Usuario";
  } else if (selectedId === "2") {
    brevoTextOption = "Inversor de Capital";
  } else if (selectedId === "3") {
    brevoTextOption = "Socio Estratégico / Cliente";
  }

  // Validar campos obligatorios
  if (!NOMBRE || !EMAIL || !SMS || !brevoTextOption) {
    console.error('❌ Validación fallida - Campos faltantes o MULT_SLCT inválido:', { NOMBRE, EMAIL, SMS, MULT_SLCT, brevoTextOption });
    return res.status(400).json({
      error: 'Campos obligatorios faltantes o MULT_SLCT inválido.',
      required: ['NOMBRE', 'EMAIL', 'SMS', 'MULT_SLCT']
    });
  }

  // Validar que tengamos un listId numérico válido
  if (Number.isNaN(listId)) {
    console.error('❌ Lista inválida:', { LIST_ID, listId });
    return res.status(400).json({
      error: 'LIST_ID inválido. Debe ser un número entero válido.',
      received: LIST_ID
    });
  }

  // Construir el payload para Brevo según su API v3
  const brevoPayload = {
    email: EMAIL,
    attributes: {
      NOMBRE: NOMBRE,
      SMS: SMS,
      MULT_SLCT: [brevoTextOption],
      MESSAGE: MESSAGE || '' // Campo opcional
    },
    listIds: [listId],
    updateEnabled: true // Permite actualizar el contacto si ya existe
  };

  console.log('📤 Payload MULT_SLCT enviado:', [brevoTextOption]);

  try {
    // Realizar petición POST a la API de Brevo
    const brevoResponse = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY // Se incluye aquí de forma segura (en servidor)
      },
      body: JSON.stringify(brevoPayload)
    });

    // Leer respuesta de Brevo
    const brevoData = await brevoResponse.json();

    // Validar respuesta de Brevo
    if (!brevoResponse.ok) {
      console.error('Error Brevo:', brevoData);
      return res.status(brevoResponse.status).json({
        error: 'Error al enviar datos a Brevo',
        details: brevoData
      });
    }

    // Éxito: retornar confirmación
    console.log('✅ Lead enviado a Brevo exitosamente:', EMAIL);
    res.json({
      success: true,
      message: 'Datos enviados a Brevo correctamente',
      data: brevoData
    });

  } catch (err) {
    // Capturar errores de red o parsing
    console.error('Error en /api/leads:', err);
    res.status(500).json({
      error: 'Error interno del servidor',
      details: err.message
    });
  }
});

/**
 * GET /
 * Health check simple para verificar que el servidor está activo.
 */
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Servidor proxy Brevo activo',
    endpoints: [
      'POST /api/leads - Enviar lead a Brevo'
    ]
  });
});

/**
 * Iniciar servidor
 */
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║  Servidor Proxy Brevo iniciado        ║
║  http://localhost:${PORT}                    ║
║  Endpoint: POST /api/leads            ║
╚════════════════════════════════════════╝
  `);
  if (!BREVO_API_KEY) {
    console.warn('⚠️  ADVERTENCIA: BREVO_API_KEY no está configurada.');
    console.warn('   Por favor, crea un archivo .env con tu clave de API.');
  }
});
