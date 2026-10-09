import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';

import { API_URL } from './api';
import { AuthService, esCuentaPendiente } from './auth.service';

// Rutas de autenticación: su 401 es una respuesta normal (credenciales incorrectas, sin sesión...), no una sesión
// caducada, y la gestiona quien las llama. Login y logout además envían su propio token CSRF desde AuthService.
const RUTAS_DE_AUTENTICACION = ['/api/auth/login', '/api/auth/me', '/api/auth/logout', '/api/auth/csrf'];

// El registro está exento de CSRF en el backend: no necesita token.
const RUTA_REGISTRO = '/api/auth/registro';

// Métodos que no modifican datos: el backend no exige token CSRF en ellos.
const METODOS_SIN_CSRF = ['GET', 'HEAD', 'OPTIONS'];

// Para las peticiones al backend:
//  - withCredentials: sin esto el navegador no envía ni guarda la cookie de sesión entre orígenes distintos.
//  - Token CSRF: las peticiones que modifican datos (POST, PUT, PATCH, DELETE) lo llevan en una cabecera. Se añade
//    aquí, en un solo sitio, para que ningún servicio (admin, categorías...) tenga que acordarse.
//  - 401 en cualquier otra ruta: la sesión ha caducado (caducidad por inactividad o absoluta); se vuelve al login.
export const apiInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const api = inject(API_URL);
  if (!peticion.url.startsWith(api)) {
    return siguiente(peticion);
  }
  const injector = inject(Injector);
  const esDeAutenticacion = RUTAS_DE_AUTENTICACION.some((ruta) => peticion.url.startsWith(api + ruta));
  const conCredenciales = peticion.clone({ withCredentials: true });

  const necesitaCsrf =
    !METODOS_SIN_CSRF.includes(peticion.method) &&
    !esDeAutenticacion &&
    !peticion.url.startsWith(api + RUTA_REGISTRO);

  const envio = necesitaCsrf
    ? enviarConCsrf(conCredenciales, siguiente, injector.get(AuthService))
    : siguiente(conCredenciales);

  return envio.pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !esDeAutenticacion) {
        injector.get(AuthService).sesionCaducada();
      }
      return throwError(() => error);
    }),
  );
};

// Envía la petición con la cabecera CSRF. Si el servidor responde 403 (token caducado o de otra sesión) pide un token
// nuevo y reintenta UNA sola vez. El 403 de "cuenta pendiente de activación" no es un fallo de CSRF y no se reintenta.
function enviarConCsrf(
  peticion: HttpRequest<unknown>,
  siguiente: HttpHandlerFn,
  auth: AuthService,
): Observable<HttpEvent<unknown>> {
  const enviar = () =>
    from(auth.tokenCsrf()).pipe(
      switchMap((csrf) => siguiente(peticion.clone({ setHeaders: { [csrf.headerName]: csrf.token } }))),
    );

  return enviar().pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 403 && !esCuentaPendiente(error)) {
        auth.olvidarCsrf();
        return enviar(); // si este segundo intento también falla, el error sale tal cual (no hay más reintentos)
      }
      return throwError(() => error);
    }),
  );
}