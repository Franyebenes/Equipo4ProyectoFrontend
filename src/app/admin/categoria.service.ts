import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
 
export interface Categoria {
  id: string;
  nombre: string;
  descripcion: string;
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
 
  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.api);
  }
 
  obtener(id: string): Observable<Categoria> {
    return this.http.get<Categoria>(`${this.api}/${id}`);
  }

  crear(categoria: Omit<Categoria, 'id'>): Observable<Categoria> {
    return this.http.post<Categoria>(this.api, categoria);
  }

  modificar(id: string, categoria: Omit<Categoria, 'id'>): Observable<Categoria> {
    return this.http.put<Categoria>(`${this.api}/${id}`, categoria);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
