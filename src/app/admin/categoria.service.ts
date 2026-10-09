import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';

export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
}

// Token CSRF que devuelve /api/auth/csrf; el backend lo exige en POST, PUT y DELETE.
interface TokenCsrf {
  token: string;
  headerName: string;
}

// Mismas reglas que CategoriaDTO en el backend. Devuelve el primer error o '' si los datos son válidos.
export function validarCategoria(datos: Omit<Categoria, 'id'>): string {
  if (!datos.nombre || !datos.descripcion) {
    return 'Rellena todos los campos obligatorios (*).';
  }
  if (datos.nombre.length > 50) {
    return 'El nombre no puede superar los 50 caracteres.';
  }
  if (datos.descripcion.length > 200) {
    return 'La descripción no puede superar los 200 caracteres.';
  }
  return '';
}

@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8080/api/admin/categorias';
  private apiCsrf = 'http://localhost:8080/api/auth/csrf';

  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.api);
  }

  obtener(id: string): Observable<Categoria> {
    return this.http.get<Categoria>(`${this.api}/${id}`);
  }

  crear(categoria: Omit<Categoria, 'id'>): Observable<Categoria> {
    return this.conCsrf((cabeceras) => this.http.post<Categoria>(this.api, categoria, { headers: cabeceras }));
  }

  modificar(id: string, categoria: Omit<Categoria, 'id'>): Observable<Categoria> {
    return this.conCsrf((cabeceras) =>
      this.http.put<Categoria>(`${this.api}/${id}`, categoria, { headers: cabeceras }),
    );
  }

  eliminar(id: string): Observable<void> {
    return this.conCsrf((cabeceras) => this.http.delete<void>(`${this.api}/${id}`, { headers: cabeceras }));
  }

  // Pide el token CSRF y lanza la peticion con el en la cabecera.
  private conCsrf<T>(peticion: (cabeceras: Record<string, string>) => Observable<T>): Observable<T> {
    return this.http
      .get<TokenCsrf>(this.apiCsrf)
      .pipe(switchMap((csrf) => peticion({ [csrf.headerName]: csrf.token })));
  }
}
