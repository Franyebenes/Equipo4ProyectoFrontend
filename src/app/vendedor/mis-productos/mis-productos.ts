import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { ProductoCatalogo, ProductoService, formatearPrecio, mensajeErrorCatalogo } from '../producto.service';

// Listado del catálogo propio: solo los productos del vendedor de la sesión, siempre leídos del backend.
@Component({
  selector: 'app-mis-productos',
  imports: [RouterLink],
  templateUrl: './mis-productos.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './mis-productos.css'],
})
export class MisProductos implements OnInit {
  private productoService = inject(ProductoService);

  readonly formatearPrecio = formatearPrecio;

  productos = signal<ProductoCatalogo[]>([]);
  cargando = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.productoService.listarMios().subscribe({
      next: (lista) => {
        this.productos.set(lista);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorCatalogo(e));
      },
    });
  }
}
