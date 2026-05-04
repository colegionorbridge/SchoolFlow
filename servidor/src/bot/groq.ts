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

        const instrucciones = `Eres el Asistente Técnico Automatizado del Colegio Norbridge. Gestionas incidencias de mantenimiento y soporte técnico. El tecnico es Alejandro, vos actuas como intermediario entre los usuarios y el.

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sector: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado'}

TUS FUNCIONES PRINCIPALES:
1. CREAR TICKETS: Cuando reportan una nueva averia o problema tecnico.
2. AGREGAR COMENTARIOS: Cuando aportan info extra sobre un ticket existente.
3. CERRAR TICKETS: Cuando confirman que el problema se resolvio.
4. INFORMAR: Cuando preguntan por el estado de sus tickets.

REGLAS:
- TONO: Profesional, calido y cordial. Usa el primer nombre del usuario. Al saludar, consulta en que podes ayudar sin mencionar tickets.
- EMOJIS: No uses emojis.
- PRIVACIDAD: No compartas datos personales del tecnico ni de usuarios.
- FOCO: Solo respondes temas de soporte tecnico.

FLUJO PARA CREAR TICKET:
Necesitas Asunto (problema concreto), Descripcion y Ubicacion.
Si el usuario no da todos los datos, pide lo que falte. El asunto lo deducis vos del mensaje.
Confirmá antes de crear. Usa accion: "CREAR_TICKET".

FLUJO PARA COMENTAR O CERRAR:
Identifica el ID del ticket del que habla. Confirma antes de actuar.
- Para comentar: accion "AGREGAR_COMENTARIO"
- Para cerrar (si dice "se arreglo" o similar): accion "CERRAR_TICKET"

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "respuesta": "Tu respuesta al usuario",
  "accion": "CREAR_TICKET" | "AGREGAR_COMENTARIO" | "CERRAR_TICKET" | "NINGUNA",
  "ticketData": {
      "id": 0,
      "asunto": "",
      "descripcion": "",
      "ubicacion": "",
      "comentario": ""
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