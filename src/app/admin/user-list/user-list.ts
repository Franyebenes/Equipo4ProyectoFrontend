import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { UserEdit } from '../user-edit/user-edit';
import { DialogoConfirmacion } from '../dialogo-confirmacion/dialogo-confirmacion';
import {
  AdminService, Usuario, Rol, EstadoUsuario, DatosModificacion,
  ETIQUETA_ROL, ETIQUETA_ESTADO, mensajeError,
} from '../admin.service';

@Component({
  selector: 'app-user-list',
  imports: [FormsModule, RouterLink, RouterLinkActive, UserEdit, DialogoConfirmacion],
  templateUrl: './user-list.html',
  styleUrls: ['../admin-shared.css', './user-list.css'],
})
export class UserList implements OnInit {
  private admin = inject(AdminService);

  readonly roles: Rol[] = ['ADMIN', 'VENDEDOR', 'CLIENTE', 'PREMIUM'];
  // Sin ELIMINADO: la eliminación es física y el usuario desaparece de la base de datos
  readonly estados: EstadoUsuario[] = ['ACTIVO', 'DESACTIVADO', 'BLOQUEADO'];
  readonly etiquetaRol = ETIQUETA_ROL;
  readonly etiquetaEstado = ETIQUETA_ESTADO;
  readonly tamano = 20;

  usuarios = signal<Usuario[]>([]);
  cargando = signal(false);
  error = signal('');
  exito = signal('');
  errorEdicion = signal('');
  usuarioAEliminar = signal<Usuario | null>(null);
  eliminando = signal(false);
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

  // Abre el diálogo de confirmación de la plataforma (el mismo que en Categorías) en lugar del confirm() del navegador
  eliminar(u: Usuario): void {
    this.exito.set('');
    this.usuarioAEliminar.set(u);
  }

  cancelarEliminacion(): void {
    if (!this.eliminando()) {
      this.usuarioAEliminar.set(null);
    }
  }

  confirmarEliminacion(): void {
    const u = this.usuarioAEliminar();
    if (!u) {
      return;
    }
    this.eliminando.set(true);
    this.error.set('');
    this.admin.eliminar(u.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.usuarioAEliminar.set(null);
        this.exito.set(`Usuario ${u.email} eliminado correctamente.`);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.usuarioAEliminar.set(null);
        this.fallo(e);
      },
    });
  }

  editar(u: Usuario): void {
    this.errorEdicion.set('');
    this.exito.set('');
    this.usuarioEditando.set(u);
  }

  guardarEdicion(evento: { id: string; datos: DatosModificacion }): void {
    this.errorEdicion.set('');
    this.admin.modificar(evento.id, evento.datos).subscribe({
      next: (u) => {
        this.usuarioEditando.set(null);
        this.exito.set(`Datos de ${u.email} guardados correctamente.`);
        this.cargar();
      },
      // El modal sigue abierto (no se pierden los cambios) y muestra el error dentro
      error: (e: HttpErrorResponse) => this.errorEdicion.set(mensajeError(e)),
    });
  }

  cancelarEdicion(): void {
    this.errorEdicion.set('');
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