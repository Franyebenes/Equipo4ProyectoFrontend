import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-list',
  imports: [CommonModule],
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
}