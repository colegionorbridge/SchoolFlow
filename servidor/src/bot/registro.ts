import { User, Sector, UserSector, Role } from '../models/models.js';

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
            const listaSectores = sectores.map((s, i) => `*${i + 1}.* ${s.nombre}`).join('\n');

            await msg.reply(`Un gusto, ${texto}.\n\nSeleccioná tu **Sector** enviando el número correspondiente:\n\n${listaSectores}`);
            break;

        case 2: // GUARDAR SECTOR ELEGIDO EN CONTEXT
            const selSector = parseInt(texto) - 1;
            const todosLosSectores = await Sector.findAll();

            if (isNaN(selSector) || !todosLosSectores[selSector]) {
                await msg.reply('❌ Selección inválida. Por favor, enviá solo el número del sector.');
                return;
            }

            const sectorElegido = todosLosSectores[selSector];
            
            user.context = {
                registro: {
                    sectorId: sectorElegido.id,
                    nombreSector: sectorElegido.nombre
                }
            };
            
            user.pasoRegistro = 3;
            user.changed('context', true); 
            await user.save(); 

            await msg.reply(`Elegiste **${sectorElegido.nombre}**.\n\nAhora, ingresá el **Código de Acceso** para este sector:`);
            break;

        case 3: // VALIDACIÓN DE CÓDIGO VS SECTOR GUARDADO
            const codigoIngresado = texto.toUpperCase().trim();
            const datosRegistro = user.context?.registro;

            if (!datosRegistro?.sectorId) {
                await msg.reply('❌ Hubo un error con la sesión. Volvamos a empezar.');
                user.pasoRegistro = 1;
                await user.save();
                return;
            }

            const sectorAValidar = await Sector.findByPk(datosRegistro.sectorId);

            if (!sectorAValidar || codigoIngresado !== sectorAValidar.codigoAcceso.toUpperCase().trim()) {
                await msg.reply(`❌ **Código incorrecto** para el sector ${datosRegistro.nombreSector}.\n\nPor favor, verificalo e intentalo de nuevo:`);
                return;
            }

            try {
                await UserSector.create({
                    userTelefono: user.telefono,
                    sectorId: sectorAValidar.id
                });
            } catch (error) {
                console.log("Aviso: El usuario ya estaba vinculado.");
            }

            user.pasoRegistro = 4;
            await user.save();
            
            await msg.reply('✅ **Código verificado correctamente.**\n\nAhora, ingresá tu **Correo Institucional** (@norbridge.edu.ar):');
            break;

        case 4: // VALIDACIÓN DE CORREO Y LISTAR ROLES
            const correo = texto.toLowerCase();

            if (!correo.endsWith('@colegionorbridge.edu.ar')) {
                await msg.reply('❌ El correo debe ser institucional (@norbridge.edu.ar). Reintentá:');
                return;
            }

            user.email = correo;
            user.pasoRegistro = 5; // Saltamos a la selección de Rol
            await user.save();

            // Buscamos los roles disponibles para que el usuario elija
            const roles = await Role.findAll();
            const listaRoles = roles.map((r, i) => `*${i + 1}.* ${r.nombre}`).join('\n');

            await msg.reply(`Excelente. Por último, seleccioná tu **Rol** en el colegio:\n\n${listaRoles}`);
            break;

        case 5: // ASIGNACIÓN DE ROL Y FINALIZACIÓN
            const selRol = parseInt(texto) - 1;
            const todosLosRoles = await Role.findAll();

            if (isNaN(selRol) || !todosLosRoles[selRol]) {
                await msg.reply('❌ Selección inválida. Por favor, enviá el número del rol correspondiente.');
                return;
            }

            const rolElegido = todosLosRoles[selRol];

            user.roleId = rolElegido.id;
            user.pasoRegistro = 6; // Estado final
            user.registroCompleto = true;
            
            // Limpiamos el contexto de registro definitivamente
            user.context = { ...user.context, registro: null }; 
            user.changed('context', true);

            await user.save();

            await msg.reply(`🎉 **¡Registro completado!**\n\nBienvenido/a, ${user.nombreCompleto}. Ya podés reportar incidencias o hacerme consultas técnicas.`);
            break;

        default:
            await msg.reply('Tu registro ya está completo. ¿En qué puedo ayudarte hoy?');
            break;
    }
};