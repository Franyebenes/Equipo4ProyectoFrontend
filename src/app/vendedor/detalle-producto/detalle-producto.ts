import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { DialogoConfirmacion } from '../../admin/dialogo-confirmacion/dialogo-confirmacion';

import {
  IMAGEN_POR_DEFECTO,
  ProductoCatalogo,
  ProductoService,
  formatearPrecio,
  mensajeConfirmarEliminacion,
  mensajeErrorCatalogo,
  mensajeEstadoCambiado,
  mensajeProductoEliminado,
  mensajeStockActualizado,
  textoStock,
  validarStock,
} from '../producto.service';

// Detalle de un producto del catálogo propio. Se pide al backend al entrar, así que muestra su estado actual.
@Component({
  selector: 'app-detalle-producto',
  imports: [RouterLink, FormsModule, DialogoConfirmacion],
  templateUrl: './detalle-producto.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './detalle-producto.css'],
})
export class DetalleProducto implements OnInit {
  private productoService = inject(ProductoService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly formatearPrecio = formatearPrecio;
  readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;
  readonly textoStock = textoStock;
  readonly mensajeConfirmarEliminacion = mensajeConfirmarEliminacion;

  producto = signal<ProductoCatalogo | null>(null);
  cargando = signal(true);
  error = signal('');
  exito = signal('');
  // Error al activar, desactivar o eliminar
  errorAccion = signal('');
  cambiandoEstado = signal(false);
  confirmandoEliminacion = signal(false);
  eliminando = signal(false);

  // Gestión de stock: cantidad que se está editando (se guarda al pulsar «Guardar stock»)
  nuevoStock = signal<number | null>(null);
  guardandoStock = signal(false);
  exitoStock = signal('');
  errorStock = signal('');
  stockSinCambios = computed(() => this.nuevoStock() === this.producto()?.stock);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.productoService.obtenerMio(id).subscribe({
      next: (producto) => {
        this.producto.set(producto);
        this.nuevoStock.set(producto.stock);
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
    this.errorAccion.set('');
    this.cambiandoEstado.set(true);
    this.productoService.cambiarEstado(producto.id, !producto.visible).subscribe({
      next: (actualizado) => {
        this.cambiandoEstado.set(false);
        this.producto.set(actualizado);
        this.exito.set(mensajeEstadoCambiado(actualizado));
      },
      error: (e: HttpErrorResponse) => {
        this.cambiandoEstado.set(false);
        this.errorAccion.set(mensajeErrorCatalogo(e));
      },
    });
  }

  // Eliminar producto: con el diálogo abierto se pide confirmación; si se cancela, no cambia nada
  pedirEliminacion(): void {
    this.exito.set('');
    this.errorAccion.set('');
    this.confirmandoEliminacion.set(true);
  }

  cancelarEliminacion(): void {
    if (!this.eliminando()) {
      this.confirmandoEliminacion.set(false);
    }
  }

  // Tras eliminarlo se vuelve al catálogo, que muestra el aviso y ya no lo incluye
  confirmarEliminacion(producto: ProductoCatalogo): void {
    this.eliminando.set(true);
    this.productoService.eliminar(producto.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.confirmandoEliminacion.set(false);
        void this.router.navigate(['/vendedor/productos'], {
          state: { exito: mensajeProductoEliminado(producto) },
        });
      },
      error: (e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.confirmandoEliminacion.set(false);
        this.errorAccion.set(mensajeErrorCatalogo(e));
      },
    });
  }

  // Botones − y +: suman o restan una unidad sin bajar de 0
  ajustarStock(unidades: number): void {
    this.exitoStock.set('');
    this.errorStock.set('');
    const actual = this.nuevoStock() ?? 0;
    this.nuevoStock.set(Math.max(0, Math.trunc(actual) + unidades));
  }

  guardarStock(producto: ProductoCatalogo): void {
    this.exitoStock.set('');
    const stock = this.nuevoStock();
    const fallo = validarStock(stock);
    this.errorStock.set(fallo);
    if (fallo || stock == null) {
      return;
    }
    this.guardandoStock.set(true);
    this.productoService.cambiarStock(producto.id, stock).subscribe({
      next: (actualizado) => {
        this.guardandoStock.set(false);
        this.producto.set(actualizado);
        this.nuevoStock.set(actualizado.stock);
        this.exitoStock.set(mensajeStockActualizado(actualizado));
      },
      error: (e: HttpErrorResponse) => {
        this.guardandoStock.set(false);
        this.errorStock.set(mensajeErrorCatalogo(e));
      },
    });
  }

  precioConDescuento(producto: ProductoCatalogo, descuento: number): string {
    return formatearPrecio(producto.precio * (1 - descuento / 100));
  }
}
