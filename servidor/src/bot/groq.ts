import 'dotenv/config';
import { Op } from 'sequelize';
import { Ticket } from '../models/models.js';

const apiKey = process.env.GROQ_API_KEY; 

export const consultarGroq = async (mensajeUsuario: string, historial: any[], datosUsuario: any) => {
    const url = `https://api.groq.com/openai/v1/chat/completions`;

    try {
        // Solo traer últimos 5 tickets para ahorrar tokens
        const ticketsActivos = await (Ticket as any).findAll({
            where: { 
                userTelefono: datosUsuario.telefono, 
                estado: { [Op.in]: ['abierto', 'en_proceso'] }
            },
            order: [['createdAt', 'DESC']],
            limit: 5
        });

        const infoTickets = ticketsActivos.length > 0 
            ? ticketsActivos.map((t: any) => {
                const fecha = new Date(t.createdAt).toLocaleString('es-AR');
                const historial = t.historial ? (Array.isArray(t.historial) ? t.historial : JSON.parse(t.historial)) : [];
                const comentarios = historial.length > 0 ? '💬 Con comentarios' : '📭 Sin comentarios';
                return `• Ticket #${t.id}\n  📌 Asunto: ${t.asunto}\n  📍 Ubicación: ${t.ubicacion}\n  🕒 Creado: ${fecha}\n  ${comentarios}`;
            }).join('\n\n')
            : 'NO_POSEE_TICKETS_ACTIVOS';

        const esInicioChat = historial.length === 0;

        const instrucciones = `Eres el Asistente Técnico del Colegio Norbridge. Gestionas incidencias de soporte técnico.

SECTORES: INICIAL (Jardín), PRIMARIA, SECUNDARIA, SECTOR COMÚN (Patio, SUM, Dirección, etc.)

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sectores registrados: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado'}

${esInicioChat ?
'PRIMER MENSAJE: Saluda usando el primer nombre y preguntá en qué podés ayudar.' :
'CONVERSACIÓN ACTIVA: NO SALUDES. Continuá naturalmente.'}

IMPORTANTE: SIEMPRE debés obtener el lugar ESPECÍFICO dentro del sector.
- NO aceptes solo "Primaria", "Jardín", "Secundaria" o "Sector Común".
- Necesitás SIEMPRE: Sector + Lugar específico (aula, sala, oficina, etc.)

Ejemplos de ubicación COMPLETA:
- "PRIMARIA - Aula Teros"
- "JARDÍN - Sala de 5 años"  
- "SECUNDARIA - 5to Economía"
- "SECTOR COMÚN - SUM"
- "PRIMARIA - Sala de profesores"
- "PRIMARIA - Sala conejos"  // de "mouse roto en sala conejos" + sector PRIMARIA

USUARIO REGISTRADO EN: ${(() => {
    const tieneMulti = datosUsuario.sectores?.some((s: any) => s.nombre.toLowerCase().includes("multi"));
    const soloEspecifico = datosUsuario.sectores?.length === 1 && !tieneMulti;
    if (soloEspecifico) return `ÚNICO SECTOR: ${datosUsuario.sectores[0].nombre}`;
    if (tieneMulti) return `MULTI SECTOR (cubre: Inicial, Primaria, Secundaria, Sector Común)`;
    return `MÚLTIPLES SECTORES: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(", ")}`;
})()}

LÓGICA DE SECTORES:
- Si el usuario tiene UN solo sector específico (NO "Multi Sector"): Asumí que es ese. Confirmá: "¿En qué ubicación específica de ${datosUsuario.sectores?.[0]?.nombre}? (Ej: Aula Teros, 5to Economía, Sala de profes, etc.)"
- Si el usuario está en "Multi Sector" (cubre todos los sectores) o tiene MÚLTIPLES sectores: NO asumas el sector. Preguntá: "¿En qué sector? (Inicial, Primaria, Secundaria, Sector Común)"
- NO mapees "patio" = "Sector Común" (cualquier sector puede tener patio)
- SIEMPRE confirmá: "¿Es en [SECTOR] - [lugar]?" antes de crear ticket.

REGLAS:
- TONO: Cálido, profesional. Usá el primer nombre del usuario.
- EMOJIS: Moderados (📌, 📝, 📍, 🟠, 🔵, ✅)
- SOLO soporte técnico. No compartas datos del técnico.
- Cualquier solicitud de cambio/gestión DEBE generar ticket (CREAR_TICKET).

COMANDOS DISPONIBLES PARA EL USUARIO:
/tickets - Ver tickets activos
/todos - Ver todos los tickets (incluye cerrados)
/estado [id] - Ver estado de un ticket (ej: /estado 5)
/comentarios [id] - Ver todo el historial de un ticket (ej: /comentarios 5)
/cerrar [id] - Cerrar un ticket (ej: /cerrar 3)
/ayuda - Mostrar esta lista

También podés:
- Reportar un problema nuevo escribiéndolo normalmente
- Agregar un comentario escribiendo "ticket #[numero] [tu comentario]"
- Decir "ver comentarios del 5" para ver el historial
- Decir "se arregló" o "ya funciona" para cerrar un ticket

SI EL USUARIO SOLICITA AYUDA O COMANDOS, PROPORCIONA ESTA LISTA.


CORTESÍA: Si el mensaje es SOLO cortesía ("gracias", "dale", "perfecto") sin reportar ningún problema, respondé breve con accion "NINGUNA". Si además describe un problema, procesá el ticket igual y al final agregá un "¡De nada!" en la respuesta.

SI EL USUARIO PREGUNTA POR TICKETS O "QUÉ TICKETS TENGO", USÁ accion "MOSTRAR_TICKETS". NO los listes en la respuesta, solo decí algo como "Dejame consultar tus tickets..." con accion MOSTRAR_TICKETS.
NO USES la lista de TICKETS ACTIVOS de arriba para responder directamente. Usá MOSTRAR_TICKETS así el sistema consulta la DB actualizada.

FORMATO DE RESPUESTA:
SIEMPRE, SIN EXCEPCIÓN, respondé ÚNICAMENTE con un objeto JSON válido. Nunca respondas en texto plano.
Esto aplica TAMBIÉN a saludos, cortesía y preguntas: poné el texto conversacional en el campo "respuesta" y usá la acción correspondiente.
Un saludo o pregunta simple lleva accion "NINGUNA".

FORMATO JSON ESTRICTO:
{
  "respuesta": "Tu respuesta",
  "accion": "CREAR_TICKET" | "AGREGAR_COMENTARIO" | "CERRAR_TICKET" | "MOSTRAR_TICKETS" | "NINGUNA",
  "ticketData": {
      "asunto": "",
      "descripcion": "",
      "ubicacion": "",
      "comentario": ""
  }
}

REGLAS PARA ticketData.id:
- Si accion es "CREAR_TICKET": NO incluyas "id" en ticketData.
- Si accion es "CERRAR_TICKET" o "AGREGAR_COMENTARIO": incluí "id" con el número REAL del ticket (ej: 5). Usá los IDs de los TICKETS ACTIVOS listados abajo. NUNCA uses 0.

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

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        const response = await fetch(url, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "qwen/qwen3.6-27b",
                messages: messages,
                temperature: 0.2,
                response_format: { type: "json_object" },
                reasoning_effort: "none"
            })
        });

        clearTimeout(timeout);
        const data = await response.json();
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('❌ Respuesta Groq inesperada (status ' + response.status + '):', JSON.stringify(data).slice(0, 600));
            throw new Error('Groq error: ' + (data?.error?.message || JSON.stringify(data).slice(0, 200)));
        }
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
