/**
 * Ejecuta acciones reales.
 * @param {*} tool 
 * @param {*} args 
 * @returns 
 */

export async function executeTool(tool, args) {

    switch(tool) {

        case "set_alarm":
            return await setAlarm(args);

        case "save_note":
            return await saveNote(args);

        default:
            throw new Error("Tool no soportada");
    };
};
