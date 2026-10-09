import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UserEdit } from '../user-edit/user-edit';
import {
  AdminService, Usuario, Rol, EstadoUsuario, DatosModificacion,
  ETIQUETA_ROL, ETIQUETA_ESTADO, mensajeError,
} from '../admin.service';

@Component({
  selector: 'app-user-list',
  imports: [FormsModule, RouterLink, RouterLinkActive, UserEdit],
  templateUrl: './user-list.html',
  styleUrls: ['../admin-shared.css', './user-list.css'],
})
export class UserList implements OnInit {
  private admin = inject(AdminService);

  readonly roles: Rol[] = ['ADMIN', 'VENDEDOR', 'CLIENTE', 'PREMIUM'];
  readonly estados: EstadoUsuario[] = ['ACTIVO', 'DESACTIVADO', 'BLOQUEADO', 'ELIMINADO'];
  readonly etiquetaRol = ETIQUETA_ROL;
  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly tamano = 20;

  usuarios = signal<Usuario[]>([]);
  cargando = signal(false);
  error = signal('');
  pagina = signal(0);
  totalPaginas = signal(0);
  totalElementos = signal(0);
  usuarioEditando = signal<Usuario | null>(null);

  filtroRol: Rol | '' = '';
  filtroEstado: EstadoUsuario | '' = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.admin.listar(this.pagina(), this.tamano, this.filtroRol, this.filtroEstado).subscribe({
      next: (p) => {
        this.usuarios.set(p.contenido);
        this.totalPaginas.set(p.totalPaginas);
        this.totalElementos.set(p.totalElementos);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  aplicarFiltros(): void {
    this.pagina.set(0);
    this.cargar();
  }

  irAPagina(n: number): void {
    this.pagina.set(n);
    this.cargar();
  }

  toggleBloqueo(u: Usuario): void {
    const peticion = u.estado === 'BLOQUEADO' ? this.admin.desbloquear(u.id) : this.admin.bloquear(u.id);
    peticion.subscribe({
      next: () => this.cargar(),
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  // Activa una cuenta pendiente (DESACTIVADO -> ACTIVO). El backend lo hace con el mismo endpoint que desbloquear.
  activar(u: Usuario): void {
    this.admin.desbloquear(u.id).subscribe({
      next: () => this.cargar(),
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  eliminar(u: Usuario): void {
    if (!confirm(`¿Seguro que quieres eliminar a ${u.email}?`)) return;
    this.admin.eliminar(u.id).subscribe({
      next: () => this.cargar(),
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  editar(u: Usuario): void {
    this.usuarioEditando.set(u);
  }

  guardarEdicion(evento: { id: string; datos: DatosModificacion }): void {
    this.admin.modificar(evento.id, evento.datos).subscribe({
      next: () => {
        this.usuarioEditando.set(null);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => this.fallo(e),
    });
  }

  cancelarEdicion(): void {
    this.usuarioEditando.set(null);
  }

  inicial(u: Usuario): string {
    return (u.nombre?.[0] ?? u.email[0]).toUpperCase();
  }

  private fallo(e: HttpErrorResponse): void {
    this.cargando.set(false);
    this.error.set(mensajeError(e));
  }
}