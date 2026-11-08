import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_URL } from '../core/api';

export type TipoErrorRecuperacion = 'validacion' | 'bloqueado' | 'servidor' | 'red';

// Error de la recuperación de contraseña ya traducido a algo que la pantalla puede mostrar.
export class ErrorRecuperacion extends Error {
  constructor(
    readonly tipo: TipoErrorRecuperacion,
    mensaje: string,
    // errores: por campo, con los códigos del backend (p. ej. { token: ['ENLACE_INVALIDO'] } o
    // { contrasena: ['CONTRASENA_CORTA', ...] }). correlationId: para citarlo al reportar un fallo.
    readonly errores: Record<string, string[]> = {},
    readonly correlationId?: string,
  ) {
    super(mensaje);
  }
}

interface RespuestaMensaje {
  mensaje: string;
}

// Las dos llamadas de la recuperación de contraseña. Son públicas pero modifican datos: el interceptor les añade el
// token CSRF. El token del enlace y la contraseña viajan siempre en el cuerpo, nunca en la URL.
@Injectable({ providedIn: 'root' })
export class RecuperacionApiService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  // Pide el correo de recuperación. El backend responde igual exista o no la cuenta (no revela qué correos hay).
  async solicitar(email: string): Promise<string> {
    return this.enviar(`${this.api}/api/auth/recuperacion`, { email });
  }

  // Fija la contraseña nueva con el token del enlace. No inicia sesión: después se entra con la contraseña nueva.
  async restablecer(token: string, contrasena: string): Promise<string> {
    return this.enviar(`${this.api}/api/auth/recuperacion/restablecer`, { token, contrasena });
  }

  private async enviar(url: string, cuerpo: Record<string, string>): Promise<string> {
    try {
      const respuesta = await firstValueFrom(this.http.post<RespuestaMensaje>(url, cuerpo));
      return respuesta.mensaje;
    } catch (error) {
      throw this.traducir(error);
    }
  }

  private traducir(error: unknown): ErrorRecuperacion {
    if (!(error instanceof HttpErrorResponse)) {
      return new ErrorRecuperacion('servidor', 'Se ha producido un error inesperado. Inténtalo de nuevo.');
    }
    const correlationId: string | undefined =
      error.error?.correlationId ?? error.headers?.get('X-Correlation-Id') ?? undefined;
    switch (error.status) {
      case 0:
        return new ErrorRecuperacion('red', 'No se puede conectar con el servidor. Comprueba tu conexión.');
      case 400:
        return new ErrorRecuperacion('validacion', 'Revisa los datos introducidos.', error.error?.errores ?? {});
      case 429:
        return new ErrorRecuperacion('bloqueado', 'Demasiados intentos. Inténtalo de nuevo más tarde.');
      case 403:
        return new ErrorRecuperacion(
          'servidor',
          'No se ha podido verificar la petición. Recarga la página e inténtalo de nuevo.',
          {},
          correlationId,
        );
      default:
        return new ErrorRecuperacion(
          'servidor',
          'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.',
          {},
          correlationId,
        );
    }
  }
}
