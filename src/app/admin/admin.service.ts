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

// Textos para los códigos de validación del backend (CodigoError).
const TEXTOS_CODIGO: Record<string, string> = {
  OBLIGATORIO: 'es obligatorio',
  FORMATO_INVALIDO: 'no tiene un formato válido',
  LONGITUD_EXCESIVA: 'es demasiado largo',
  DOMINIO_EMAIL_INEXISTENTE: 'tiene un dominio que no existe',
  TELEFONO_INVALIDO: 'debe tener 9 números',
  AVATAR_NO_PERMITIDO: 'no es un avatar permitido',
  CONTRASENAS_NO_COINCIDEN: 'no coincide con la contraseña',
  CONTRASENA_CORTA: 'debe tener al menos 12 caracteres',
  CONTRASENA_LARGA: 'es demasiado larga',
  CONTRASENA_COMUN: 'es demasiado común',
  CONTRASENA_FILTRADA: 'aparece en filtraciones conocidas',
  CONTRASENA_CON_DATOS_PERSONALES: 'no puede contener tu nombre o tu correo',
};

export function mensajeError(e: HttpErrorResponse): string {
  if (e.status === 0) return 'No se puede conectar con el servidor. ¿Está arrancado el backend?';
  if (e.status === 401) return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
  if (e.status === 403) return 'No tienes permisos para realizar esta acción.';
  const cuerpo = e.error;
  // 400 con errores por campo: {"errores": {"email": ["FORMATO_INVALIDO"]}}
  if (e.status === 400 && cuerpo?.errores) {
    return Object.entries(cuerpo.errores as Record<string, string[]>)
      .map(([campo, codigos]) => `${campo}: ${codigos.map((c) => TEXTOS_CODIGO[c] ?? c).join(', ')}`)
      .join(' · ');
  }
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