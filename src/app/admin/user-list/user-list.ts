import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-user-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css'
})
export class UserList {
  usuarios = [
    { nombre: 'Ana Admin', email: 'ana@esibuy.com', roles: ['ADMIN'], status: 'ACTIVE' },
    { nombre: 'Carlos Cliente', email: 'carlos@esibuy.com', roles: ['CUSTOMER'], status: 'ACTIVE' },
    { nombre: 'Vero Vendedora', email: 'vero@esibuy.com', roles: ['SELLER'], status: 'PENDING_ACTIVATION' },
    { nombre: 'Pablo Bloqueado', email: 'pablo@esibuy.com', roles: ['CUSTOMER'], status: 'BLOCKED' }
  ];

  filtroRol: string = 'TODOS';

  get usuariosFiltrados() {
    if (this.filtroRol === 'TODOS') {
      return this.usuarios;
    }
    return this.usuarios.filter(u => u.roles.includes(this.filtroRol));
  }

  eliminarUsuario(email: string) {
    this.usuarios = this.usuarios.filter(u => u.email !== email);
  }
  toggleBloqueo(email: string) {
  const usuario = this.usuarios.find(u => u.email === email);
  if (usuario) {
    usuario.status = usuario.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
  }
}
}