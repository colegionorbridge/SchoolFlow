import { User, Sector, UserSector } from '../models/models.js';

export const manejarRegistro = async (msg: any, user: any, telefono: string) => {
    const texto = msg.body.trim();

    // --- PASO 0: CREACIÓN INICIAL ---
    if (!user) {
        await User.create({
            telefono: telefono,
            pasoRegistro: 1,
            nombreCompleto: '',
            esAdmin: false
        });
        await msg.reply('🏫 **Registro IT - Colegio Norbridge**\n\n¡Hola! Para comenzar, por favor ingresá tu **Nombre y Apellido**:');
        return;
    }

    switch (user.pasoRegistro) {
        case 1: // GUARDAR NOMBRE Y LISTAR SECTORES
            user.nombreCompleto = texto;
            user.pasoRegistro = 2;
            await user.save();

            const sectores = await Sector.findAll();
            const lista = sectores.map((s, i) => `*${i + 1}.* ${s.nombre}`).join('\n');

            await msg.reply(`Un gusto, ${texto}.\n\nSeleccioná tu **Sector** enviando el número correspondiente:\n\n${lista}`);
            break;

        case 2: // GUARDAR SECTOR ELEGIDO EN CONTEXT
            const seleccion = parseInt(texto) - 1;
            const todosLosSectores = await Sector.findAll();

            if (isNaN(seleccion) || !todosLosSectores[seleccion]) {
                await msg.reply('❌ Selección inválida. Por favor, enviá solo el número (ej: 1).');
                return;
            }

            const sectorElegido = todosLosSectores[seleccion];
            
            // Usamos el campo JSON 'context' para persistir la elección
            user.context = {
                registro: {
                    sectorId: sectorElegido.id,
                    nombreSector: sectorElegido.nombre
                }
            };
            
            user.pasoRegistro = 3;
            await user.save(); 

            await msg.reply(`Elegiste **${sectorElegido.nombre}**.\n\nAhora, ingresá el **Código de Acceso** para este sector:`);
            break;

        case 3: // VALIDACIÓN DE CÓDIGO VS SECTOR GUARDADO
            const codigoIngresado = texto.toUpperCase().trim();
            
            // Recuperamos la info del JSON context de forma segura
            const datosRegistro = user.context?.registro;

            if (!datosRegistro?.sectorId) {
                await msg.reply('❌ Hubo un error con la sesión. Volvamos a empezar.');
                user.pasoRegistro = 1;
                await user.save();
                return;
            }

            const sectorAValidar = await Sector.findByPk(datosRegistro.sectorId);

            // Validamos que el código pertenezca al sector que el usuario eligió antes
            if (!sectorAValidar || codigoIngresado !== sectorAValidar.codigoAcceso.toUpperCase().trim()) {
                await msg.reply(`❌ **Código incorrecto** para el sector ${datosRegistro.nombreSector}.\n\nPor favor, verificalo e intentalo de nuevo:`);
                return;
            }

            // ÉXITO: Vinculamos al usuario con el sector en la tabla intermedia
            try {
                await UserSector.create({
                    userTelefono: user.telefono,
                    sectorId: sectorAValidar.id
                });
            } catch (error) {
                console.log("Aviso: El usuario ya estaba vinculado o error en tabla intermedia");
            }

            // Limpiamos la parte de 'registro' del contexto para dejarlo prolijo
            user.context = { ...user.context, registro: null }; 
            user.pasoRegistro = 4;
            await user.save();
            
            await msg.reply('✅ **Código verificado correctamente.**\n\nPor último, ingresá tu **Correo Institucional** (@norbridge.edu.ar):');
            break;

        case 4: // VALIDACIÓN DE CORREO Y CIERRE
            const correo = texto.toLowerCase();

            if (!correo.endsWith('@norbridge.edu.ar')) {
                await msg.reply('❌ El correo debe ser institucional y terminar en **@norbridge.edu.ar**. Reintentá:');
                return;
            }

            user.email = correo;
            user.pasoRegistro = 5; // Estado final para habilitar IA
            user.registroCompleto = true;
            await user.save();

            await msg.reply('🎉 **¡Registro completado con éxito!**\n\nYa podés hacerme cualquier consulta técnica sobre soporte, redes o PCs.');
            break;

        default:
            await msg.reply('Tu registro ya está completo. ¿En qué puedo ayudarte hoy?');
            break;
    }
};