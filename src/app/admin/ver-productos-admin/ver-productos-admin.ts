import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { mensajeDeError } from '../../core/mensaje-error';
import { Pagina, ProductoAdmin, ProductoAdminService } from '../producto-admin.service';

/** Todos los productos de la plataforma, en modo lectura: sin acciones para editar, desactivar ni borrar. */
@Component({
  selector: 'app-ver-productos-admin',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './ver-productos-admin.html',
  styleUrls: ['../admin-shared.css', './ver-productos-admin.css'],
})
export class VerProductosAdmin {
  private readonly servicio = inject(ProductoAdminService);

  protected readonly pagina = signal<Pagina<ProductoAdmin> | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly formatoPrecio = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

  constructor() {
    this.cargar(0);
  }

  protected cargar(numero: number): void {
    this.cargando.set(true);
    this.error.set(null);
    this.servicio.listar(numero).subscribe({
      next: (p) => {
        this.pagina.set(p);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected precio(valor: number | null): string {
    return valor == null ? '—' : this.formatoPrecio.format(valor);
  }
}
