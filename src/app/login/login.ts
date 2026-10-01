import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// Página de login. Solo presentación: no llama al backend ni finge sesión.
@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  // Evita el envío real; el backend de auth todavía no está cableado.
  enviar(evento: Event): void {
    evento.preventDefault();
  }
}
