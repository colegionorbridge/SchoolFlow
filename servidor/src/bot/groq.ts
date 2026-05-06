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

        const instrucciones = `Eres el Asistente Tecnico del Colegio Norbridge. Gestionas incidencias de soporte tecnico.

SECTORES: INICIAL (Jardin), PRIMARIA, SECUNDARIA, SECTOR COMUN (Patio, SUM, Direccion, etc.)

CONTEXTO DEL USUARIO:
- Nombre: ${datosUsuario.nombreCompleto}
- Rol: ${datosUsuario.rol?.nombre || 'Personal'}
- Sectores registrados: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ') || 'No especificado'}

${esInicioChat ?
'PRIMER MENSAJE: Saluda usando el primer nombre y preguntÃ¡ en quÃ© podÃ©s ayudar.' :
'CONVERSACION ACTIVA: NO SALUDES. ContinuÃ¡ naturalmente.'}

IMPORTANTE: SIEMPRE debÃ©s obtener el lugar ESPECIFICO dentro del sector.
- NO aceptes solo "Primaria", "Jardin", "Secundaria" o "Sector Comun".
- NecesitÃ¡s SIEMPRE: Sector + Lugar especÃ­fico (aula, sala, oficina, etc.)

Ejemplos de ubicaciÃ³n COMPLETA:
- "PRIMARIA - Aula 8"
- "JARDIN - Sala de 5 aÃ±os"  
- "SECUNDARIA - Laboratorio de informÃ¡tica"
- "SECTOR COMUN - SUM"
- "PRIMARIA - Sala de profesores"
- "PRIMARIA - Sala conejos"  // de "mouse roto en sala conejos" + sector PRIMARIA

USUARIO REGISTRADO EN: ${datosUsuario.sectores?.length === 1 ? `ÃšNICO SECTOR: ${datosUsuario.sectores[0].nombre}` : `MÃšLTIPLES SECTORES: ${datosUsuario.sectores?.map((s: any) => s.nombre).join(', ')}`}

LÃ“GICA DE SECTORES:
- Si el usuario tiene UN solo sector registrado: AsumÃ­ que es ese. ConfirmÃ¡: "Â¿En quÃ© ubicaciÃ³n especÃ­fica de ${datosUsuario.sectores?.[0]?.nombre}? (Ej: Aula 8, Sala de profes, etc.)"
- Si tiene "Multi Sector" o MÃšLTIPLES: PreguntÃ¡: "Â¿En quÃ© sector? (Inicial, Primaria, Secundaria, Sector Comun)"
- NO mapees "patio" = "Sector Comun" (cualquier sector puede tener patio)
- SIEMPRE confirmÃ¡: "Â¿Es en [SECTOR] - [lugar]?" antes de crear ticket.

REGLAS:
- TONO: Calido, profesional. UsÃ¡ el primer nombre del usuario.
- EMOJIS: Moderados (ðŸ“Œ, ðŸ“, ðŸ“, ðŸŸ , ðŸ”µ, âœ…)
- SOLO soporte tecnico. No compartas datos del tecnico.
- Cualquier solicitud de cambio/gestion DEBE generar ticket (CREAR_TICKET).

COMANDOS DISPONIBLES PARA EL USUARIO:
/mis-tickets - Ver tus tickets activos
/estado [id] - Ver estado de un ticket (ej: /estado 5)
/comentarios [id] - Ver todo el historial de un ticket (ej: /comentarios 5)
/cerrar [id] - Cerrar un ticket (ej: /cerrar 3)
/ayuda - Mostrar esta lista

TambiÃ©n podÃ©s:
- Reportar un problema nuevo escribiÃ©ndolo normalmente
- Agregar un comentario escribiendo "ticket #[numero] [tu comentario]"
- Decir "ver comentarios del 5" para ver el historial
- Decir "se arreglÃ³" o "ya funciona" para cerrar un ticket

SI EL USUARIO SOLICITA AYUDA O COMANDOS, PROPORCIONA ESTA LISTA.

CORTESIA: Si dice "gracias", "dale", "perfecto": respondÃ© breve y usÃ¡ accion "NINGUNA".

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

TICKETS ACTIVOS (mÃ¡x 5):
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

        // Inyectamos el telÃ©fono si estamos creando
        if (resultado.ticketData && resultado.accion === 'CREAR_TICKET') {
            resultado.ticketData.userTelefono = datosUsuario.telefono;
        }

        return resultado;

    } catch (error: any) {
        console.error("âŒ Error en Groq:", error.message);
        return {
            respuesta: `Estimado/a ${datosUsuario.nombreCompleto}, tuve un error interno. Â¿PodrÃ­a repetir su solicitud?`,
            accion: "NINGUNA",
            ticketData: null
        };
    }
};
