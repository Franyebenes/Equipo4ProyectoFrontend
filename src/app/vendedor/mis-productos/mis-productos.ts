import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { coincideBusqueda } from '../../core/busqueda';
import { ProductoCatalogo, ProductoService, formatearPrecio, mensajeErrorCatalogo } from '../producto.service';

// Listado del catálogo propio: solo los productos del vendedor de la sesión, siempre leídos del backend.
@Component({
  selector: 'app-mis-productos',
  imports: [RouterLink, FormsModule],
  templateUrl: './mis-productos.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './mis-productos.css'],
})
export class MisProductos implements OnInit {
  private productoService = inject(ProductoService);

  readonly formatearPrecio = formatearPrecio;

  productos = signal<ProductoCatalogo[]>([]);
  cargando = signal(false);
  error = signal('');

  // Buscador por nombre y filtro por categoría. Se aplican sobre la lista ya cargada, sin volver a pedirla.
  busqueda = signal('');
  categoriaFiltro = signal('');

  // Categorías de los productos del vendedor, sin repetir y en orden alfabético, para el desplegable
  categoriasDisponibles = computed(() =>
    [...new Set(this.productos().flatMap((p) => p.categorias))].sort((a, b) => a.localeCompare(b, 'es')),
  );

  productosFiltrados = computed(() => {
    const categoria = this.categoriaFiltro();
    return this.productos().filter(
      (p) => coincideBusqueda(p.nombre, this.busqueda()) && (!categoria || p.categorias.includes(categoria)),
    );
  });

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoriaFiltro.set('');
  }

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
