import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import { erroresDeCampo, mensajeDeError } from '../../core/mensaje-error';
import { AVATARES_CON_IMAGEN, DatosPerfil, PerfilService, avatarPorDefecto, imagenDeAvatar } from '../perfil.service';

/** Mismas reglas que el backend: sin < > { } $ */
const TEXTO_SEGURO = /^[^<>{}$]*$/;

/** Formulario "Editar perfil" (HU-32.2). El email y el DNI se muestran pero no se pueden cambiar. */
@Component({
  selector: 'app-editar-perfil',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './editar-perfil.html',
  styleUrl: './editar-perfil.css',
})
export class EditarPerfil {
  private readonly perfilService = inject(PerfilService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly perfil = signal<DatosPerfil | null>(null);
  protected readonly avatares = signal<string[]>([]);
  protected readonly error = signal<string | null>(null);
  /** Códigos de error por campo que devuelve el backend (p. ej. MENOR_DE_EDAD) */
  protected readonly erroresServidor = signal<Record<string, string[]>>({});
  protected readonly guardando = signal(false);
  /** Del catálogo del backend, solo los que tienen imagen en el frontend. */
  protected readonly avataresDisponibles = computed(() =>
    this.avatares().filter((avatar) => AVATARES_CON_IMAGEN.includes(avatar)),
  );

  protected readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(TEXTO_SEGURO)]],
    apellidos: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(TEXTO_SEGURO)]],
    telefono: ['', [Validators.pattern(/^([0-9]{9})?$/)]],
    fechaNacimiento: [''],
    avatar: ['', [Validators.required]],
    nombreComercial: ['', [Validators.maxLength(80), Validators.pattern(TEXTO_SEGURO)]],
  });

  constructor() {
    this.perfilService.avatares().subscribe((lista) => this.avatares.set(lista));
    this.perfilService.obtener().subscribe({
      next: (p) => {
        this.perfil.set(p);
        this.formulario.patchValue({
          nombre: p.nombre,
          apellidos: p.apellidos,
          telefono: p.telefono ?? '',
          fechaNacimiento: p.fechaNacimiento ?? '',
          avatar: p.avatar ?? '',
          nombreComercial: p.nombreComercial ?? '',
        });
        if (p.rol === 'VENDEDOR') {
          this.formulario.controls.nombreComercial.addValidators(Validators.required);
          this.formulario.controls.nombreComercial.updateValueAndValidity();
        }
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  /** Con el avatar por defecto del backend (que no está en el catálogo) se marca el azul, que es el que se muestra. */
  protected estaElegido(avatar: string, p: DatosPerfil): boolean {
    const actual = this.formulario.controls.avatar.value;
    return actual === avatar || (!AVATARES_CON_IMAGEN.includes(actual) && avatar === avatarPorDefecto(p.rol));
  }

  protected imagenDe(avatar: string, p: DatosPerfil): string {
    return imagenDeAvatar(avatar, p.rol);
  }

  protected elegirAvatar(avatar: string): void {
    this.formulario.controls.avatar.setValue(avatar);
    this.formulario.controls.avatar.markAsDirty();
  }

  protected invalido(campo: 'nombre' | 'apellidos' | 'telefono' | 'nombreComercial'): boolean {
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid;
  }

  protected tieneError(campo: string, codigo: string): boolean {
    return this.erroresServidor()[campo]?.includes(codigo) ?? false;
  }

  protected guardar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    const v = this.formulario.getRawValue();
    this.guardando.set(true);
    this.error.set(null);
    this.erroresServidor.set({});
    this.perfilService
      .modificar({
        nombre: v.nombre.trim(),
        apellidos: v.apellidos.trim(),
        telefono: v.telefono || null,
        fechaNacimiento: v.fechaNacimiento || null,
        avatar: v.avatar,
        nombreComercial: v.nombreComercial.trim() || null,
      })
      .subscribe({
        next: async () => {
          await this.auth.restaurarSesion(); // la cabecera se actualiza con el nombre y el avatar nuevos
          await this.router.navigateByUrl('/perfil');
        },
        error: (e) => {
          this.guardando.set(false);
          this.error.set(mensajeDeError(e));
          this.erroresServidor.set(erroresDeCampo(e));
        },
      });
  }
}