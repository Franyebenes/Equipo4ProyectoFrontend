import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { API_URL } from '../core/api';
import { AuthService } from '../core/auth.service';

export type TipoErrorDosFactores = 'validacion' | 'bloqueado' | 'conflicto' | 'servidor' | 'red';

// Error de la verificación en dos pasos ya traducido a algo que la pantalla puede mostrar.
export class ErrorDosFactores extends Error {
  constructor(
    readonly tipo: TipoErrorDosFactores,
    mensaje: string,
    // errores: por campo, con los códigos del backend (p. ej. { contrasena: ['CONTRASENA_INCORRECTA'] } o
    // { codigo: ['CODIGO_INCORRECTO'] }). correlationId: para citarlo al reportar un fallo.
    readonly errores: Record<string, string[]> = {},
    readonly correlationId?: string,
  ) {
    super(mensaje);
  }
}

export interface EstadoDosFactores {
  activo: boolean;
  codigosRecuperacionDisponibles: number;
}

// Lo que necesita la persona para dar de alta la cuenta en su aplicación autenticadora.
export interface ActivacionIniciada {
  // Se dibuja en el QR (otpauth://...).
  uri: string;
  // El mismo secreto en Base32, para escribirlo a mano si no se puede escanear.
  secreto: string;
}

interface RespuestaCodigos {
  codigosRecuperacion: string[];
}

// Las llamadas de /api/2fa (cuenta con sesión). Modifican datos: el interceptor les añade el token CSRF. La contraseña y los
// códigos viajan siempre en el cuerpo, nunca en la URL. Tras confirmar la activación o regenerar los códigos el backend
// renueva la sesión: el token CSRF cambia, así que se descarta el que se tuviera guardado.
@Injectable({ providedIn: 'root' })
export class DosFactoresApiService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly auth = inject(AuthService);

  async estado(): Promise<EstadoDosFactores> {
    return this.llamar(() => this.http.get<EstadoDosFactores>(`${this.api}/api/2fa`));
  }

  // Pide el QR. Todavía no cambia nada en la cuenta: no activa el 2FA hasta confirmar con un código.
  async iniciarActivacion(contrasena: string): Promise<ActivacionIniciada> {
    return this.llamar(() => this.http.post<ActivacionIniciada>(`${this.api}/api/2fa/activacion`, { contrasena }));
  }

  // Confirma con el primer código de la aplicación. Devuelve los códigos de recuperación, que no se vuelven a mostrar.
  async confirmarActivacion(codigo: string): Promise<string[]> {
    const respuesta = await this.llamar(() =>
      this.http.post<RespuestaCodigos>(`${this.api}/api/2fa/activacion/confirmar`, { codigo }),
    );
    this.auth.olvidarCsrf();
    return respuesta.codigosRecuperacion;
  }

  // Sustituye los códigos de recuperación por otros nuevos (los anteriores dejan de valer). Exige contraseña y un código.
  async regenerarCodigos(contrasena: string, codigo: string): Promise<string[]> {
    const respuesta = await this.llamar(() =>
      this.http.post<RespuestaCodigos>(`${this.api}/api/2fa/codigos-recuperacion`, { contrasena, codigo }),
    );
    this.auth.olvidarCsrf();
    return respuesta.codigosRecuperacion;
  }

  private async llamar<T>(peticion: () => Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion());
    } catch (error) {
      throw this.traducir(error);
    }
  }

  private traducir(error: unknown): ErrorDosFactores {
    if (!(error instanceof HttpErrorResponse)) {
      return new ErrorDosFactores('servidor', 'Se ha producido un error inesperado. Inténtalo de nuevo.');
    }
    const correlationId: string | undefined =
      error.error?.correlationId ?? error.headers?.get('X-Correlation-Id') ?? undefined;
    switch (error.status) {
      case 0:
        return new ErrorDosFactores('red', 'No se puede conectar con el servidor. Comprueba tu conexión.');
      case 400:
        return new ErrorDosFactores('validacion', 'Revisa los datos introducidos.', error.error?.errores ?? {});
      case 409:
        return new ErrorDosFactores('conflicto', 'Esa operación no está disponible ahora mismo.');
      case 429:
        return new ErrorDosFactores('bloqueado', 'Demasiados intentos. Inténtalo de nuevo más tarde.');
      case 403:
        return new ErrorDosFactores(
          'servidor',
          'No se ha podido verificar la petición. Recarga la página e inténtalo de nuevo.',
          {},
          correlationId,
        );
      default:
        return new ErrorDosFactores(
          'servidor',
          'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.',
          {},
          correlationId,
        );
    }
  }
}
