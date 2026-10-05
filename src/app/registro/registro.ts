import { Component, signal } from '@angular/core';

// Tipos de rol que se ven en el mockup de registro.
type RolRegistro = 'cliente' | 'vendedor';

// Página de registro. Distinta de login. Sin llamada a /api/auth ni paso 2.
@Component({
  selector: 'app-registro',
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  // Cliente aparece marcado por defecto, como en el mockup.
  rol = signal<RolRegistro>('cliente');

  elegirRol(rol: RolRegistro): void {
    this.rol.set(rol);
  }

  // No crea cuenta ni abre verificación de correo.
  enviar(evento: Event): void {
    evento.preventDefault();
  }
}
