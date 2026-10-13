import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '../api.config';
import { Categoria, RespuestaRegistro, SolicitudRegistro } from './registro-api';

@Injectable({ providedIn: 'root' })
export class RegistroApiService {
  private readonly http = inject(HttpClient);

  // Un único endpoint para cualquier tipo de cuenta; devuelve 201 si todo va bien.
  registrar(solicitud: SolicitudRegistro): Observable<RespuestaRegistro> {
    return this.http.post<RespuestaRegistro>(`${API_URL}/auth/registro`, solicitud);
  }

  // Categorías para el desplegable del vendedor, ya ordenadas por el backend.
  categorias(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(`${API_URL}/registro/categorias`);
  }
}
