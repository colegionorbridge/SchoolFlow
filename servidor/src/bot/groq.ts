import 'dotenv/config';
import { Ticket } from '../models/models.js';

const apiKey = process.env.GROQ_API_KEY; 

export const consultarGroq = async (mensajeUsuario: string, historial: any[], datosUsuario: any) => {
    const url = `https://api.groq.com/openai/v1/chat/completions`;

    try {
        // Solo traer últimos 5 tickets para ahorrar tokens
        const ticketsActivos = await (Ticket as any).findAll({
            where: { 
                userTelefono: datosUsuario.telefono, 
                estado: ['abierto', 'en_proceso'] 
            },
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        const infoTickets = ticketsActivos.length > 0 
            ? ticketsActivos.map((t: any) => `#${t.id} - ${t.asunto} (${t.estado})`).join('\n')
            : 'NO_POSEE_TICKETS_ACTIVOS';

        const esInicioChat = historial.length === 0;

        const instrucciones = `Eres el Asistente Tecnico del Colegio Norbridge. Gestionas incidencias de soporte tecnico.

SECTORES: INICIAL (Jardin), PRIMARIA, SECUNDARIA, SECTOR COMUN (Patio, SUM, Direccion, etc.)

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sectores registrados: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado'}

${esInicioChat ?
'PRIMER MENSAJE: Saluda usando el primer nombre y preguntá en qué podés ayudar.' :
'CONVERSACION ACTIVA: NO SALUDES. Continuá naturalmente.'}

IMPORTANTE: SIEMPRE debés obtener el lugar ESPECIFICO dentro del sector.
- NO aceptes solo "Primaria", "Jardin", "Secundaria" o "Sector Comun".
- Necesitás SIEMPRE: Sector + Lugar específico (aula, sala, oficina, etc.)

Ejemplos de ubicación COMPLETA:
- "PRIMARIA - Aula 8"
- "JARDIN - Sala de 5 años"  
- "SECUNDARIA - Laboratorio de informática"
- "SECTOR COMUN - SUM"
- "PRIMARIA - Sala de profesores"

USUARIO REGISTRADO EN: ${datosUsuario.sectores?.length === 1 ? `ÚNICO SECTOR: ${datosUsuario.sectores[0].nombre}` : `MÚLTIPLES SECTORES: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ')}`}

LÓGICA DE SECTORES:
- Si el usuario tiene UN solo sector registrado: Asumí que es ese. Confirmá: "¿En qué ubicación específica de ${datosUsuario.sectores?.[0]?.nombre}? (Ej: Aula 8, Sala de profes, etc.)"
- Si tiene "Multi Sector" o MÚLTIPLES: Preguntá: "¿En qué sector? (Inicial, Primaria, Secundaria, Sector Comun)"
- NO mapees "patio" = "Sector Comun" (cualquier sector puede tener patio)
- SIEMPRE confirmá: "¿Es en [SECTOR] - [lugar]?" antes de crear ticket.

REGLAS:
- TONO: Calido, profesional. Usá el primer nombre del usuario.
- EMOJIS: Moderados (📌, 📝, 📍, 🟠, 🔵, ✅)
- SOLO soporte tecnico. No compartas datos del tecnico.
- Cualquier solicitud de cambio/gestion DEBE generar ticket (CREAR_TICKET).

CORTESIA: Si dice "gracias", "dale", "perfecto": respondé breve y usá accion "NINGUNA".

FORMATO JSON ESTRICTO:
{
  "respuesta": "Tu respuesta",
  "accion": "CREAR_TICKET" | "AGREGAR_COMENTARIO" | "CERRAR_TICKET" | "NINGUNA",
  "ticketData": {
      "id": 0,
      "asunto": "",
      "descripcion": "",
      "ubicacion": "",
      "comentario": ""
  }
}

TICKETS ACTIVOS (máx 5):
${infoTickets}`;

        const messages = [
            { role: "system", content: instrucciones },
            ...historial.map(h => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: h.content || ""
            })),
            { role: "user", content: mensajeUsuario }
        ];

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: messages,
                temperature: 0.2,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const resultado = JSON.parse(data.choices[0].message.content);

        // Inyectamos el teléfono si estamos creando
        if (resultado.ticketData && resultado.accion === 'CREAR_TICKET') {
            resultado.ticketData.userTelefono = datosUsuario.telefono;
        }

        return resultado;

    } catch (error: any) {
        console.error("❌ Error en Groq:", error.message);
        return {
            respuesta: `Estimado/a ${datosUsuario.nombreCompleto}, tuve un error interno. ¿Podría repetir su solicitud?`,
            accion: "NINGUNA",
            ticketData: null
        };
    }
};