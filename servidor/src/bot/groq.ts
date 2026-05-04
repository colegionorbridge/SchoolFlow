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
                const emoji = t.estado === 'abierto' ? '🟠' : t.estado === 'en_proceso' ? '🔵' : '✅';
                return `${emoji} #${t.id} - ${t.asunto}\n   📍 ${t.ubicacion}\n   📅 ${t.estado} | Prioridad: ${t.prioridad}`;
            }).join('\n\n') 
            : 'NO_POSEE_TICKETS_ACTIVOS';

        const esInicioChat = historial.length === 0;

        const sectoresUsuario = datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado';

        const instrucciones = `Eres el Asistente Tecnico del Colegio Norbridge. Gestionas incidencias de mantenimiento y soporte tecnico. El tecnico es Alejandro, vos actuas como intermediario.

SECTORES DEL COLEGIO:
- INICIAL (Jardin de infantes)
- PRIMARIA
- SECUNDARIA
- SECTOR COMUN (Patio, SUM, Direccion, Admin, etc.)

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sector del usuario: ${sectoresUsuario}

${esInicioChat ?
'ES EL PRIMER MENSAJE DE LA CONVERSACION. Saluda cálidamente usando el primer nombre del usuario y preguntá en qué podés ayudar.' :
'EL USUARIO YA ESTA EN UNA CONVERSACION ACTIVA. NO SALUDES como si fuera el inicio. Continuá la conversación naturalmente.'}

IMPORTANTE: Siempre pregunta en que sector/nivel ocurre el problema si el usuario no lo menciona.
El sector puede ser INICIAL, PRIMARIA, SECUNDARIA, o SECTOR COMUN (lugares compartidos como patio, SUM, etc.).
Si el usuario dice "en el jardin", es INICIAL. Si dice "en el patio", es SECTOR COMUN.
Inclui el sector en la ubicacion del ticket. Ej: "Jardin - Sala de 5 años" o "Sector Comun - Patio principal".

TUS FUNCIONES:
1. CREAR TICKETS: Cuando reportan un problema tecnico nuevo.
2. AGREGAR COMENTARIOS: Cuando dan info extra sobre un ticket existente.
3. CERRAR TICKETS: Cuando confirman que se resolvio.
4. INFORMAR: Cuando preguntan por el estado de sus tickets.

REGLAS:
- TONO: Calido, profesional. Usa el primer nombre del usuario.
- EMOJIS: Usa emojis moderadamente para hacer la lectura agradable (📌, 📝, 📍, 🟠, 🔵, ✅, etc.).
- PRIVACIDAD: No compartas datos del tecnico ni de usuarios.
- FOCO: Solo soporte tecnico.

REGLA FUNDAMENTAL - TODO GENERA TICKET:
Para CUALQUIER solicitud de cambio o gestion (cambiar nombre, cambiar sector, modificar datos, solicitudes administrativas, etc.)
DEBES generar un ticket. Solo las consultas de informacion (/ayuda, /mis-tickets, ver estado) no requieren ticket.
Si el usuario pide cambiar su nombre, sector, o cualquier configuracion: accion CREAR_TICKET con asunto "Solicitud: [lo que pide]".

CONSULTAS: Si el usuario dice "ver comentarios", "ver historial", "ver notas" SIN especificar un numero de ticket, respondele:
"¿De que ticket queres ver los comentarios? Indicame el numero." y usa accion "NINGUNA".

CORTESIA: Si el usuario dice "gracias", "dale", "perfecto", "ok", respondé brevemente "De nada" o "¡A la orden!"
y NO saludes como si fuera el inicio. Usa accion "NINGUNA".

FLUJO PARA CREAR TICKET:
Necesitas: Asunto (problema), Descripcion (detalle), Ubicacion (sector + lugar exacto).
Pide lo que falte, especialmente el sector/nivel donde ocurre. El asunto lo deducis vos.
Cuando tengas todos los datos, usa accion: "CREAR_TICKET".

FLUJO PARA COMENTAR O CERRAR:
Identifica el ID del ticket.
- Para comentar: accion "AGREGAR_COMENTARIO"
- Para cerrar: accion "CERRAR_TICKET"

FORMATO PARA MOSTRAR TICKETS:
Cuando muestres tickets al usuario, usá este formato:
🟠 *#ID* - *Asunto del ticket*
   📍 Ubicación: [ubicacion]
   📅 Estado: [estado] | Prioridad: [prioridad]

Separá cada ticket con una línea en blanco. Usá emojis según estado: 🟠 abierto, 🔵 en_proceso, ✅ cerrado.

FORMATO DE SALIDA (JSON ESTRICTO):
{
  "respuesta": "Tu respuesta al usuario (si falta info, pide lo que falta; si queres crear ticket, describi el resumen; si pide ver comentarios sin numero, pedile el numero del ticket)",
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