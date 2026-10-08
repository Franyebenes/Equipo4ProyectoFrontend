import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { API_URL } from './api';
import { AuthService } from './auth.service';

// Rutas de autenticación: su 401 es una respuesta normal (credenciales incorrectas, sin sesión...), no una sesión
// caducada, y la gestiona quien las llama.
const RUTAS_DE_AUTENTICACION = ['/api/auth/login', '/api/auth/me', '/api/auth/logout', '/api/auth/csrf'];

// Para las peticiones al backend:
//  - withCredentials: sin esto el navegador no envía ni guarda la cookie de sesión entre orígenes distintos.
//  - 401 en cualquier otra ruta: la sesión ha caducado (caducidad por inactividad o absoluta); se vuelve al login.
export const apiInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const api = inject(API_URL);
  if (!peticion.url.startsWith(api)) {
    return siguiente(peticion);
  }
  const injector = inject(Injector);
  const esDeAutenticacion = RUTAS_DE_AUTENTICACION.some((ruta) => peticion.url.startsWith(api + ruta));
  return siguiente(peticion.clone({ withCredentials: true })).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !esDeAutenticacion) {
        injector.get(AuthService).sesionCaducada();
      }
      return throwError(() => error);
    }),
  );
};
