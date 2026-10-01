import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UserList } from './admin/user-list/user-list';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UserList],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  menuAbierto = signal(false);

  alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected title = 'esibuy-frontend';
}
