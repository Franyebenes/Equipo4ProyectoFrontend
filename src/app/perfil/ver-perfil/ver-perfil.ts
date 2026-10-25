import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { mensajeDeError } from '../../core/mensaje-error';
import { DatosPerfil, PerfilService, imagenDeAvatar } from '../perfil.service';

/** Página "Mi perfil". Muestra los datos que corresponden al rol del usuario. */
@Component({
  selector: 'app-ver-perfil',
  imports: [RouterLink, DatePipe],
  templateUrl: './ver-perfil.html',
  styleUrl: './ver-perfil.css',
})
export class VerPerfil {
  protected readonly perfilService = inject(PerfilService);

  protected readonly perfil = signal<DatosPerfil | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly esCliente = computed(() => {
    const rol = this.perfil()?.rol;
    return rol === 'CLIENTE' || rol === 'PREMIUM';
  });
  protected readonly imagen = computed(() => imagenDeAvatar(this.perfil()?.avatar, this.perfil()?.rol));
  protected readonly tipoCuenta = computed(() => {
    switch (this.perfil()?.rol) {
      case 'PREMIUM':
        return 'Cliente Premium';
      case 'CLIENTE':
        return 'Cliente Estándar';
      case 'VENDEDOR':
        return 'Vendedor';
      case 'ADMIN':
        return 'Administrador';
      default:
        return '';
    }
  });

  constructor() {
    this.perfilService.obtener().subscribe({
      next: (perfil) => this.perfil.set(perfil),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }
}