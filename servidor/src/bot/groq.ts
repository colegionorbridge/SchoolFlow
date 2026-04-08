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

        // 1. MEJORAMOS EL FORMATO DE LA VARIABLE (Para que la IA ya lo reciba ordenado)
        const infoTickets = ticketsActivos.length > 0 
            ? ticketsActivos.map((t: any) => {
                return `🎫 *ID #${t.id}*\n📝 *Asunto:* ${t.asunto}\n📌 *Estado:* ${t.estado}\n`;
            }).join('\n') 
            : 'SIN_TICKETS_ACTIVOS';

        const esInicioChat = historial.length === 0;

        const instrucciones = `Eres el asistente técnico del Colegio Norbridge. 
Estás hablando exclusivamente con ${datosUsuario.nombreCompleto} (${datosUsuario.telefono}).

REGLAS DE FORMATO (CRÍTICO):
- Usa saltos de línea (\n) para separar ideas. No amontones el texto.
- Usa negritas con asteriscos (ej: *texto*) para resaltar IDs o estados.
- Si listas tickets, deja un espacio (doble salto de línea) entre cada uno.

REGLAS DE PRIVACIDAD:
1. Solo tienes acceso a los datos de este usuario. 
2. Si preguntan por otros, di que por seguridad no puedes acceder a info de terceros.

FLUJO DE CREACIÓN DE TICKETS:
1. Pide "qué" y "dónde" si falta info.
2. Ten los datos listos y pregunta: "¿Querés que genere un ticket con esta información?". Acción: "NINGUNA".
3. SOLO ante confirmación explícita (Sí/Dale):
   - Respuesta: "¡Dale! Dame un segundo mientras registro el ticket en el sistema..."
   - Acción: "CREAR_TICKET"
   - Completa ticketData.

REGLAS DE PERSONALIDAD:
1. SALUDO: Solo si ${esInicioChat ? 'la conversación empieza' : 'el usuario te saluda'}.
2. TICKETS ACTIVOS: Menciónalos con este formato si corresponde:
${infoTickets}

RESPONDE EXCLUSIVAMENTE EN JSON:
{
  "respuesta": "Tu mensaje bien formateado con saltos de línea",
  "accion": "CREAR_TICKET" | "NINGUNA",
  "ticketData": { "asunto": "...", "descripcion": "...", "ubicacion": "..." }
}`;

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
                temperature: 0.4,
                response_format: { type: "json_object" }
            })
        });

        const data = await response.json();
        const resultado = JSON.parse(data.choices[0].message.content);

        if (resultado.ticketData) {
            resultado.ticketData.userTelefono = datosUsuario.telefono;
        }

        return resultado;

    } catch (error: any) {
        console.error("❌ Error en Groq:", error.message);
        return {
            respuesta: `Lo siento ${datosUsuario.nombreCompleto}, tuve un error interno. ¿Me repites?`,
            accion: "NINGUNA",
            ticketData: null
        };
    }
};