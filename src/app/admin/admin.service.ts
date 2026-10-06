import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Rol = 'CLIENTE' | 'PREMIUM' | 'VENDEDOR' | 'ADMIN';
export type EstadoUsuario = 'ACTIVO' | 'DESACTIVADO' | 'BLOQUEADO' | 'ELIMINADO';

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  dni: string | null;
  telefono: string | null;
  nombreComercial: string | null;
  sede: string | null;
  avatar: string | null;
  fechaIncorporacion: string | null;
  roles: Rol[];
  estado: EstadoUsuario;
}

export interface Pagina<T> {
  contenido: T[];
  pagina: number;
  tamano: number;
  totalElementos: number;
  totalPaginas: number;
}

export interface DatosModificacion {
  nombre: string;
  apellidos: string;
  dni: string;
  telefono: string;
  sede: string;
}

export interface DatosAltaAdmin {
  nombre: string;
  apellidos: string;
  email: string;
  sede: string;
  avatar: string;
  contrasena: string;
  repetirContrasena: string;
  FechaIncorporacion: string;
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  CLIENTE: 'Cliente',
  PREMIUM: 'Premium',
  VENDEDOR: 'Vendedor',
  ADMIN: 'Admin',
};

export const ETIQUETA_ESTADO: Record<EstadoUsuario, string> = {
  ACTIVO: 'Activo',
  DESACTIVADO: 'Pendiente de activación',
  BLOQUEADO: 'Bloqueado',
  ELIMINADO: 'Eliminado',
};

export function mensajeError(e: HttpErrorResponse): string {
  if (e.status === 0) return 'No se puede conectar con el servidor. ¿Está arrancado el backend?';
  if (e.status === 401 || e.status === 403) return 'Necesitas iniciar sesión como administrador para hacer esto.';
  const cuerpo = e.error;
  if (typeof cuerpo === 'string' && cuerpo) return cuerpo;
  return cuerpo?.mensaje ?? cuerpo?.message ?? 'Ha ocurrido un error. Inténtalo de nuevo.';
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private api = 'http://localhost:8080/api/admin/usuarios';

  listar(pagina: number, tamano: number, rol: Rol | '', estado: EstadoUsuario | ''): Observable<Pagina<Usuario>> {
    let params = new HttpParams().set('pagina', pagina).set('tamano', tamano);
    if (rol) params = params.set('rol', rol);
    if (estado) params = params.set('estado', estado);
    return this.http.get<Pagina<Usuario>>(this.api, { params });
  }

  modificar(id: string, datos: DatosModificacion): Observable<Usuario> {
    return this.http.put<Usuario>(`${this.api}/${id}`, datos);
  }

  bloquear(id: string): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.api}/${id}/bloquear`, {});
  }

  desbloquear(id: string): Observable<Usuario> {
    return this.http.patch<Usuario>(`${this.api}/${id}/desbloquear`, {});
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  crearAdministrador(datos: DatosAltaAdmin): Observable<Usuario> {
    return this.http.post<Usuario>(`${this.api}/administradores`, datos);
  }
}