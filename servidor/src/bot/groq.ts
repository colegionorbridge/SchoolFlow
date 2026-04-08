import 'dotenv/config';

// Asegúrate de que en tu .env la variable sea GROQ_API_KEY
const apiKey = process.env.GROQ_API_KEY; 

export const consultarGroq = async (mensajeUsuario: string, historial: any[], datosUsuario: any) => {
    // Endpoint de Groq (formato compatible con OpenAI)
    const url = `https://api.groq.com/openai/v1/chat/completions`;

    const instrucciones = `Eres el asistente técnico oficial del Colegio Norbridge. 
Creado por Alejandro Gonzalez Candia (Responsable de IT). 
Estás hablando con ${datosUsuario.nombreCompleto} (Rol: ${datosUsuario.rol?.nombre || 'Personal'}).
Tu objetivo es resolver incidencias técnicas paso a paso. Si el problema escala, deriva a Alejandro.`;

    // Adaptamos el historial al formato OpenAI/Groq que espera esta API
    const messages = [
        { role: "system", content: instrucciones },
        ...historial.map(h => ({
            role: h.role === 'model' ? 'assistant' : 'user',
            content: h.parts[0].text
        })),
        { role: "user", content: mensajeUsuario }
    ];

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile", // El modelo más potente y gratuito en Groq
                messages: messages,
                temperature: 0.7
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("❌ Error de Groq API:", data);
            throw new Error(data.error?.message || "Error en la API de Groq");
        }

        // Retornamos el contenido de la respuesta
        return data.choices[0].message.content;

    } catch (error: any) {
        console.error("❌ Error en la comunicación con Groq:", error.message);
        return "Hola! Mi sistema de IA está bajo mantenimiento breve. ¿Podrías intentar escribirme de nuevo en un segundo?";
    }
};