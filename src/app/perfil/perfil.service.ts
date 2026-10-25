import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { API_URL } from '../core/api';
import { Rol } from '../core/auth.service';

export interface DatosPerfil {
  id: string;
  email: string;
  rol: Rol;
  nombre: string;
  apellidos: string;
  dni: string | null;
  fechaNacimiento: string | null; // 'AAAA-MM-DD'
  telefono: string | null;
  avatar: string | null;
  nombreComercial: string | null;
  sede: string | null;
}

export interface CambiosPerfil {
  nombre: string;
  apellidos: string;
  telefono: string | null;
  fechaNacimiento: string | null;
  avatar: string;
  nombreComercial: string | null;
}

@Injectable({ providedIn: 'root' })
export class PerfilService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  obtener(): Observable<DatosPerfil> {
    return this.http.get<DatosPerfil>(`${this.api}/api/perfil`);
  }

  modificar(cambios: CambiosPerfil): Observable<DatosPerfil> {
    return this.http.put<DatosPerfil>(`${this.api}/api/perfil`, cambios);
  }

  avatares(): Observable<string[]> {
    return this.http.get<string[]>(`${this.api}/api/registro/avatares`);
  }
}

/** Avatares del catálogo que tienen imagen en public/avatares/clientes y public/avatares/vendedores. */
export const AVATARES_CON_IMAGEN = ['avatar-01', 'avatar-02', 'avatar-03', 'avatar-04'];

/** Avatar del catálogo que se muestra cuando el usuario no ha elegido ninguno: el azul de cada carpeta. */
export function avatarPorDefecto(rol: Rol | undefined): string {
  return rol === 'VENDEDOR' ? 'avatar-04' : 'avatar-01';
}

/** Imagen del avatar (cabecera y perfil). Los vendedores tienen su propia carpeta; los demás usan la de clientes. */
export function imagenDeAvatar(avatar: string | null | undefined, rol: Rol | undefined): string {
  const id = avatar && AVATARES_CON_IMAGEN.includes(avatar) ? avatar : avatarPorDefecto(rol);
  return `/avatares/${rol === 'VENDEDOR' ? 'vendedores' : 'clientes'}/${id}.png`;
}