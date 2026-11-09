import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { formatearValoracion } from '../../cliente/catalogo.service';
import { mensajeDeError } from '../../core/mensaje-error';
import { IMAGEN_POR_DEFECTO, urlImagen } from '../../vendedor/producto.service';
import { ProductoAdminDetalle, ProductoAdminService } from '../producto-admin.service';

/** Ficha de un producto para el administrador, en modo lectura: sin acciones para editar, desactivar ni borrar. */
@Component({
  selector: 'app-detalle-producto-admin',
  imports: [RouterLink],
  templateUrl: './detalle-producto-admin.html',
  styleUrls: ['../admin-shared.css', './detalle-producto-admin.css'],
})
export class DetalleProductoAdmin {
  private readonly servicio = inject(ProductoAdminService);

  protected readonly producto = signal<ProductoAdminDetalle | null>(null);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly urlImagen = urlImagen;
  protected readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;
  protected readonly formatearValoracion = formatearValoracion;
  private readonly formatoPrecio = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
    this.servicio.obtener(id).subscribe({
      next: (p) => {
        this.producto.set(p);
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

  /** Cinco posiciones: true si esa estrella va rellena. */
  protected estrellas(media: number): boolean[] {
    return [1, 2, 3, 4, 5].map((n) => n <= Math.round(media));
  }
}
