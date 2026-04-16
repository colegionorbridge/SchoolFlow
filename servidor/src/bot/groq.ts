import 'dotenv/config';
import { Ticket } from '../models/models.js';

const apiKey = process.env.GROQ_API_KEY; 

export const consultarGroq = async (mensajeUsuario: string, historial: any[], datosUsuario: any) => {
    const url = `https://api.groq.com/openai/v1/chat/completions`;

    try {
        const ticketsActivos = await (Ticket as any).findAll({
            where: { 
                userTelefono: datosUsuario.telefono, 
                estado: ['abierto', 'en_proceso'] 
            },
            order: [['createdAt', 'DESC']]
        });

        // Formateo previo de tickets para que la IA solo los inyecte si es necesario
        const infoTickets = ticketsActivos.length > 0 
            ? ticketsActivos.map((t: any) => {
                return `ID #${t.id}\nAsunto: ${t.asunto}\nUbicación: ${t.ubicacion}\nEstado: ${t.estado}\n`;
            }).join('\n') 
            : 'NO_POSEE_TICKETS_ACTIVOS';

        const esInicioChat = historial.length === 0;

        const instrucciones = `Eres el Asistente Técnico Automatizado del Colegio Norbridge. Tu única función es gestionar incidencias de mantenimiento y soporte técnico.

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Teléfono: ${datosUsuario.telefono}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sector: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado'}

MISIÓN:
Interpretar el mensaje del usuario para:
1. Crear un nuevo ticket de reparación.
2. Informar sobre el estado de sus tickets actuales.

REGLAS CRÍTICAS DE COMPORTAMIENTO:
- TONO: Estrictamente profesional, serio y cordial. Si  su nombre completo es muy largo, puedes usar solo su primer nombre ".
- EMOJIS: Prohibido el uso de emojis en cualquier parte de la respuesta.
- ENFOQUE UNIDIRECCIONAL: No respondas preguntas que no tengan que ver con soporte técnico del colegio (clima, charlas generales, etc.). Si el usuario intenta salir del tema, redirígelo cortésmente a la gestión de tickets.
- PRIVACIDAD: No reveles datos de otros usuarios.

FLUJO DE TRABAJO PARA NUEVOS TICKETS:
Para generar un ticket necesitas: ASUNTO (qué pasó), DESCRIPCIÓN (detalles) y UBICACIÓN (aula/sector).
1. Si falta información, pídela de forma directa y profesional.
2. Cuando tengas la información completa, presenta un resumen y pregunta: "¿Desea que registre este ticket en el sistema?".
3. SOLO si el usuario confirma explícitamente (ej: "Sí", "Confirmado", "Dale"), responde con la frase de transición: "Entendido. Procesando el registro en el sistema, por favor aguarde..." y envía accion: "CREAR_TICKET".

GESTIÓN DE TICKETS EXISTENTES:
- Si el usuario consulta por sus tickets o si es el inicio de la conversación (${esInicioChat}), informa sobre estos registros:
${infoTickets}
- Usa negritas con asteriscos solo para encabezados o datos clave (ej: *ID #101*).

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "respuesta": "Tu mensaje siguiendo las reglas de formato (usa \\n para saltos de línea)",
  "accion": "CREAR_TICKET" | "NINGUNA",
  "ticketData": { 
      "asunto": "Breve y claro", 
      "descripcion": "Detallada", 
      "ubicacion": "Específica" 
  }
}

Si no estás creando un ticket, ticketData debe ir con strings vacíos.`;

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
                temperature: 0.2, // Bajamos la temperatura para mayor seriedad y menos "creatividad"
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const resultado = JSON.parse(data.choices[0].message.content);

        if (resultado.ticketData && resultado.accion === 'CREAR_TICKET') {
            resultado.ticketData.userTelefono = datosUsuario.telefono;
        }

        return resultado;

    } catch (error: any) {
        console.error("❌ Error en Groq:", error.message);
        return {
            respuesta: `Estimado/a ${datosUsuario.nombreCompleto}, se ha producido un error en el sistema de procesamiento. Por favor, reintente su solicitud.`,
            accion: "NINGUNA",
            ticketData: null
        };
    }
};