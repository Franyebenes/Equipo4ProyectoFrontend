import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
 
export interface Categoria {
  nombre: string;
  descripcion: string;
}
 
@Injectable({ providedIn: 'root' })
export class CategoriaService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8080/api/admin/categorias';
 
  listar(): Observable<Categoria[]> {
    return this.http.get<Categoria[]>(this.api);
  }
 
  crear(categoria: Categoria): Observable<Categoria> {
    return this.http.post<Categoria>(this.api, categoria);
  }
}
