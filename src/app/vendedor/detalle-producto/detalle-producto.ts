import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import {
  IMAGEN_POR_DEFECTO,
  ProductoCatalogo,
  ProductoService,
  formatearPrecio,
  mensajeErrorCatalogo,
  mensajeEstadoCambiado,
} from '../producto.service';

// Detalle de un producto del catálogo propio. Se pide al backend al entrar, así que muestra su estado actual.
@Component({
  selector: 'app-detalle-producto',
  imports: [RouterLink],
  templateUrl: './detalle-producto.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './detalle-producto.css'],
})
export class DetalleProducto implements OnInit {
  private productoService = inject(ProductoService);
  private route = inject(ActivatedRoute);

  readonly formatearPrecio = formatearPrecio;
  readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;

  producto = signal<ProductoCatalogo | null>(null);
  cargando = signal(true);
  error = signal('');
  exito = signal('');
  errorEstado = signal('');
  cambiandoEstado = signal(false);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.productoService.obtenerMio(id).subscribe({
      next: (producto) => {
        this.producto.set(producto);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorCatalogo(e));
      },
    });
  }

  // Activar/Desactivar producto: la ficha muestra al momento el estado que devuelve el backend
  alternarEstado(producto: ProductoCatalogo): void {
    this.exito.set('');
    this.errorEstado.set('');
    this.cambiandoEstado.set(true);
    this.productoService.cambiarEstado(producto.id, !producto.visible).subscribe({
      next: (actualizado) => {
        this.cambiandoEstado.set(false);
        this.producto.set(actualizado);
        this.exito.set(mensajeEstadoCambiado(actualizado));
      },
      error: (e: HttpErrorResponse) => {
        this.cambiandoEstado.set(false);
        this.errorEstado.set(mensajeErrorCatalogo(e));
      },
    });
  }

  precioConDescuento(producto: ProductoCatalogo, descuento: number): string {
    return formatearPrecio(producto.precio * (1 - descuento / 100));
  }
}
