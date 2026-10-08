import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService, DatosAltaAdmin, mensajeError } from '../admin.service';

@Component({
  selector: 'app-dar-alta-admin',
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './dar-alta-admin.html',
  styleUrls: ['../admin-shared.css', './dar-alta-admin.css'],
})
export class DarAltaAdmin {
  private admin = inject(AdminService);

  datos: DatosAltaAdmin = this.vacio();
  enviando = signal(false);
  error = signal('');
  exito = signal('');

  enviar(): void {
    this.error.set('');
    this.exito.set('');
    const d = this.datos;

    if (!d.nombre.trim() || !d.apellidos.trim() || !d.email.trim() || !d.sede.trim() || !d.contrasena) {
      this.error.set('Rellena todos los campos obligatorios (*).');
      return;
    }
    if (d.contrasena !== d.repetirContrasena) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.enviando.set(true);
    const envio: DatosAltaAdmin = { ...d, email: d.email.trim().toLowerCase() };
    this.admin.crearAdministrador(envio).subscribe({
      next: (u) => {
        this.enviando.set(false);
        this.datos = this.vacio();
        this.exito.set(`Administrador ${u.email} creado correctamente.`);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }

  private vacio(): DatosAltaAdmin {
    return {
      nombre: '', apellidos: '', email: '', sede: '', avatar: '',
      contrasena: '', repetirContrasena: '', FechaIncorporacion: '',
    };
  }
}