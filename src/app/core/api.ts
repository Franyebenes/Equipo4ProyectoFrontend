import { InjectionToken } from '@angular/core';

// URL base del backend. Front y back van en puertos distintos, así que las peticiones son entre orígenes y llevan
// credenciales (ver api.interceptor.ts). El origen del front (localhost:43127) está permitido en el CORS del backend
// (propiedad app.cors.allowed-origin). Para otro entorno basta con proporcionar otro valor a este token.
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:8080',
});
