import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';

import { API_URL } from './api';

// Mismos valores que el enum Rol del backend.
export type Rol = 'CLIENTE' | 'PREMIUM' | 'VENDEDOR' | 'ADMIN';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  // Identificador del avatar del perfil (p. ej. 'avatar-01'); null o ausente si no eligió ninguno.
  avatar?: string | null;
}

export type TipoError = 'credenciales' | 'pendiente' | 'validacion' | 'bloqueado' | 'servidor' | 'red';

// Código con el que el backend avisa de que las credenciales son correctas pero la cuenta aún no está activada.
const CUENTA_PENDIENTE = 'CUENTA_PENDIENTE_DE_ACTIVACION';

// Error de autenticación ya traducido a algo que la pantalla puede mostrar.
export class ErrorAutenticacion extends Error {
  constructor(
    readonly tipo: TipoError,
    mensaje: string,
    // errores: por campo, con los códigos del backend (OBLIGATORIO, FORMATO_INVALIDO, LONGITUD_EXCESIVA).
    // reintentarEnSegundos: valor de Retry-After en un 429. correlationId: para citarlo al reportar un fallo.
    readonly detalle: {
      errores?: Record<string, string[]>;
      reintentarEnSegundos?: number;
      correlationId?: string;
    } = {},
  ) {
    super(mensaje);
  }
}

// necesario para el interceptor: si el backend responde 403 con este código, no es un fallo de CSRF y no se reintenta.
export function esCuentaPendiente(error: HttpErrorResponse): boolean {
  return error.error?.codigo === CUENTA_PENDIENTE;
}

interface TokenCsrf {
  token: string;
  headerName: string;
}

interface RespuestaLogin extends Usuario {
  mensaje: string;
}

// Sesión del usuario. El backend la lleva en una cookie HttpOnly que el navegador envía solo (el interceptor pone
// withCredentials); aquí se guarda únicamente quién es el usuario, para pintar la interfaz.
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly api = inject(API_URL);

  private readonly _usuario = signal<Usuario | null>(null);
  readonly usuario = this._usuario.asReadonly();

  // Token CSRF vigente. Está ligado a la sesión: al iniciar o cerrar sesión cambia, así que se descarta.
  private csrf: TokenCsrf | null = null;

  // Recupera al usuario tras recargar la página (la cookie sigue viva). Nunca falla: sin sesión, o con el backend
  // caído, simplemente no hay usuario.
  async restaurarSesion(): Promise<void> {
    try {
      const usuario = await firstValueFrom(this.http.get<Usuario>(`${this.api}/api/auth/me`));
      this._usuario.set(usuario);
    } catch {
      this._usuario.set(null);
    }
  }

  async login(email: string, contrasena: string): Promise<Usuario> {
    try {
      // El backend rechaza con 400 cualquier campo que no sea email y contrasena.
      const respuesta = await this.enviarConCsrf((cabeceras) =>
        this.http.post<RespuestaLogin>(`${this.api}/api/auth/login`, { email, contrasena }, { headers: cabeceras }),
      );
      // El login rota la sesión: el token CSRF anterior ya no vale y se pedirá otro en la próxima petición.
      this.csrf = null;
      const usuario: Usuario = {
        id: respuesta.id,
        email: respuesta.email,
        nombre: respuesta.nombre,
        rol: respuesta.rol,
        avatar: respuesta.avatar,
      };
      this._usuario.set(usuario);
      return usuario;
    } catch (error) {
      throw this.traducirError(error);
    }
  }

  // Cierra la sesión en el servidor. El estado local se descarta siempre, aunque el servidor no responda.
  async logout(): Promise<void> {
    try {
      await this.enviarConCsrf((cabeceras) =>
        this.http.post<void>(`${this.api}/api/auth/logout`, null, { headers: cabeceras }),
      );
    } catch (error) {
      throw this.traducirError(error);
    } finally {
      this.descartarSesion();
    }
  }

  // La sesión ha caducado o ya no es válida (un 401 en una petición normal): se limpia y se va al login.
  sesionCaducada(): void {
    this.descartarSesion();
    void this.router.navigateByUrl('/login');
  }

  private descartarSesion(): void {
    this._usuario.set(null);
    this.csrf = null;
  }

  // cambiado a public para que sea accesible desde el interceptor
  async tokenCsrf(): Promise<TokenCsrf> {
    if (!this.csrf) {
      this.csrf = await firstValueFrom(this.http.get<TokenCsrf>(`${this.api}/api/auth/csrf`));
    }
    return this.csrf;
  }
  // despues de recibir un 403, se descarta el token CSRF para que la próxima petición pida uno nuevo
  olvidarCsrf(): void {
    this.csrf = null;
  }

  // Envía una petición que modifica datos con el token CSRF. Si el servidor responde 403 (token caducado o de otra
  // sesión) pide uno nuevo y reintenta una sola vez. El 403 de "cuenta pendiente de activación" no es un fallo de
  // CSRF y no se reintenta.
  private async enviarConCsrf<T>(peticion: (cabeceras: HttpHeaders) => Observable<T>): Promise<T> {
    for (let intento = 0; ; intento++) {
      const csrf = await this.tokenCsrf();
      try {
        return await firstValueFrom(peticion(new HttpHeaders({ [csrf.headerName]: csrf.token })));
      } catch (error) {
        if (error instanceof HttpErrorResponse && error.status === 403 && !esCuentaPendiente(error) && intento === 0) {
          this.csrf = null;
          continue;
        }
        throw error;
      }
    }
  }

  private traducirError(error: unknown): ErrorAutenticacion {
    if (error instanceof ErrorAutenticacion) {
      return error;
    }
    if (!(error instanceof HttpErrorResponse)) {
      return new ErrorAutenticacion('servidor', 'Se ha producido un error inesperado. Inténtalo de nuevo.');
    }
    const correlationId: string | undefined =
      error.error?.correlationId ?? error.headers?.get('X-Correlation-Id') ?? undefined;
    switch (error.status) {
      case 0:
        return new ErrorAutenticacion('red', 'No se puede conectar con el servidor. Comprueba tu conexión.');
      case 400:
        return new ErrorAutenticacion('validacion', 'Revisa los datos introducidos.', {
          errores: error.error?.errores ?? {},
        });
      case 401:
        return new ErrorAutenticacion('credenciales', 'Correo o contraseña incorrectos.');
      case 429:
        return new ErrorAutenticacion('bloqueado', 'Demasiados intentos.', {
          reintentarEnSegundos: Number(error.headers.get('Retry-After')) || 0,
        });
      case 403:
        if (esCuentaPendiente(error)) {
          return new ErrorAutenticacion(
            'pendiente',
            'Cuenta pendiente de activación. Un administrador debe activarla antes de que puedas entrar.',
          );
        }
        return new ErrorAutenticacion(
          'servidor',
          'No se ha podido verificar la petición. Recarga la página e inténtalo de nuevo.',
          { correlationId },
        );
      default:
        return new ErrorAutenticacion(
          'servidor',
          'El servicio no está disponible en este momento. Inténtalo de nuevo más tarde.',
          { correlationId },
        );
    }
  }
}
