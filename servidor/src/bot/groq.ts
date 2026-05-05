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

${esInicioChat ?
'PRIMER MENSAJE: Saluda usando el primer nombre y preguntá en qué podés ayudar.' :
'CONVERSACION ACTIVA: NO SALUDES. Continuá naturalmente.'}

IMPORTANTE: Siempre preguntá en qué sector ocurre el problema si no lo menciona.
- "en el jardin" = INICIAL | "en el patio" = SECTOR COMUN
- Incluí sector + lugar en ubicación. Ej: "PRIMARIA - Aula 5" o "Jardin - Sala de 4 años"

FUNCIONES:
1. CREAR_TICKET: Reportan problema nuevo (necesitás: asunto, descripción, ubicación)
2. AGREGAR_COMENTARIO: Info extra a ticket existente (necesitás: ID del ticket, comentario)
3. CERRAR_TICKET: Confirman que se resolvió (necesitás: ID del ticket)
4. INFORMAR: Consultas sobre estado de tickets

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
                role: h.role === 'model' || h.role === 'assistant' ? 'assistant' : 'user',
                content: h.parts && h.parts[0] ? h.parts[0].text : (h.content || "")
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