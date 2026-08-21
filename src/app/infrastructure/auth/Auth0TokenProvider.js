import GetTokenService from "./GetTokenService.js";

// interface Auth0TokenResponse {
//   access_token: string;
//   token_type: string;
//   expires_in: number;
// }

export class Auth0TokenProvider {
  accessToken = null;
  expiresAt = 0;

  /**
   * Obtengo el token de acceso de Auth0. Si el token actual es válido, lo devuelve; de lo contrario, solicita un nuevo token.
   * @returns Token de acceso válido de Auth0.
   */
  async getAccessToken() {
    const now = Date.now();

    // Margen de seguridad de 60 segundos
    if (this.accessToken && now < this.expiresAt - 60_000) {
      return this.accessToken;
    }

    return this.requestNewToken();
  }


  /**
   * Solicita un nuevo token de acceso de Auth0.
   * @returns Token de acceso de Auth0.
   */
  async requestNewToken() {
   
    const response = await GetTokenService();

    if (!response.ok) {
      const error = await response.text();

      throw new Error(
        `Token request failed (${response.status}): ${error}`,
      );
    }

    const data = (await response.json()) ;

    this.accessToken = data.access_token;

    this.expiresAt =
      Date.now() + data.expires_in * 1000;

    return this.accessToken;
  }
}
