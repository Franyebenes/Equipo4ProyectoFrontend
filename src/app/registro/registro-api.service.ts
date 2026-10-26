import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { ActivacionRegistro, Categoria, RespuestaRegistro, SolicitudRegistro } from './registro-api';

@Injectable({ providedIn: 'root' })
export class RegistroApiService {
  private readonly http = inject(HttpClient);

  // Primer paso: genera el secreto del 2FA para ese correo y lo guarda en la sesión (cifrado). Aún no crea ninguna cuenta.
  prepararDosFactores(email: string): Observable<ActivacionRegistro> {
    return this.http.post<ActivacionRegistro>(`${API_URL}/auth/registro/2fa`, { email });
  }

  // Segundo paso, un único endpoint para cualquier tipo de cuenta; devuelve 201 si todo va bien. Lleva el primer código del 2FA.
  registrar(solicitud: SolicitudRegistro): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(`${API_URL}/auth/registro`, solicitud);
  }

  // Categorías para el desplegable del vendedor, ya ordenadas por el backend.
  categorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${API_URL}/registro/categorias`);
  }
}
