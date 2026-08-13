/**
 *  Obtengo un token de acceso de Auth0 usando el flujo de credenciales de cliente.
 * @returns  Una promesa que resuelve con la respuesta de la solicitud de token.
 */
const GetTokenService = async (): Promise<Response> => {

    const domain       = process.env.AUTH0_DOMAIN;          // Dominio de Auth0.
    const clientId     = process.env.AUTH0_CLIENT_ID;       // ID del cliente de Auth0.
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;   // Secreto del cliente de Auth0.
    const audience     = process.env.AUTH0_AUDIENCE;        // Audiencia para la que se solicita el token.
    
    if (!domain || !clientId || !clientSecret || !audience) {
      throw new Error("Missing Auth0 configuration");
    }

    return await fetch(`https://${domain}/oauth/token`, {
        method: "POST",
        headers: {
        "Content-Type": "application/json",
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            audience,
        }),
    });
};


export default GetTokenService;