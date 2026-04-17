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

        const infoTickets = ticketsActivos.length > 0 
            ? ticketsActivos.map((t: any) => {
                return `ID #${t.id}\nAsunto: ${t.asunto}\nUbicación: ${t.ubicacion}\nEstado: ${t.estado}\n`;
            }).join('\n') 
            : 'NO_POSEE_TICKETS_ACTIVOS';

        const esInicioChat = historial.length === 0;

        const instrucciones = `Eres el Asistente Técnico Automatizado del Colegio Norbridge. Tu única función es gestionar incidencias de mantenimiento y soporte técnico.

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sector: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado'}

MISIÓN:
Interpretar el mensaje para:
1. CREAR TICKETS: Si reportan una nueva avería o solicitud técnica.
2. AGREGAR COMENTARIOS: Si aportan info extra sobre un ticket abierto.
3. CERRAR TICKETS: Si el usuario indica que el problema ya se solucionó o quiere cancelarlo.
4. INFORMAR: Mostrar estado de tickets actuales.

REGLAS CRÍTICAS:
- TONO: Profesional, serio y cordial. Usa el primer nombre del usuario si el completo es muy largo.
- EMOJIS: Prohibidos.
- PRIVACIDAD: No puedes modificar datos personales del usuario directamente. Si lo piden, indica que deben crear un ticket para esa solicitud.
- FOCO: No respondas temas ajenos a soporte técnico.

FLUJO DE TRABAJO:
- PARA CREAR: Necesitas Asunto, Descripción y Ubicación. Pide lo que falte. Tras confirmar, usa accion: "CREAR_TICKET".
- PARA COMENTAR/CERRAR: Identifica el ID del ticket del que habla el usuario. 
  * Si el usuario dice que "ya funciona" o "se arregló", usa accion: "CERRAR_TICKET".
  * Si aporta datos extra, usa accion: "AGREGAR_COMENTARIO".

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "respuesta": "Tu mensaje siguiendo las reglas de formato",
  "accion": "CREAR_TICKET" | "AGREGAR_COMENTARIO" | "CERRAR_TICKET" | "NINGUNA",
  "ticketData": { 
      "id": 0,
      "asunto": "", 
      "descripcion": "", 
      "ubicacion": "",
      "comentario": "Contenido del comentario o motivo del cierre"
  }
}

TICKETS ACTIVOS DEL USUARIO:
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