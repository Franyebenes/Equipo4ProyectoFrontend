import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { ProductoCatalogo, ProductoService, formatearPrecio, mensajeErrorCatalogo } from '../producto.service';

// Espera tras la última tecla antes de buscar: una petición al backend, no una por tecla
const ESPERA_BUSQUEDA_MS = 300;

// Listado del catálogo propio: solo los productos del vendedor de la sesión, siempre leídos del backend.
// La búsqueda por nombre la hace el backend; el filtro por categoría se aplica sobre la lista recibida.
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

  busqueda = signal('');
  categoriaFiltro = signal('');

  private temporizadorBusqueda: ReturnType<typeof setTimeout> | undefined;
  // Petición en curso: si llega otra búsqueda se cancela, para que una respuesta antigua no pise a la nueva
  private peticion: Subscription | undefined;

  // Categorías de los productos recibidos, sin repetir y en orden alfabético, para el desplegable
  categoriasDisponibles = computed(() =>
    [...new Set(this.productos().flatMap((p) => p.categorias))].sort((a, b) => a.localeCompare(b, 'es')),
  );

  productosFiltrados = computed(() => {
    const categoria = this.categoriaFiltro();
    return this.productos().filter((p) => !categoria || p.categorias.includes(categoria));
  });

  hayFiltros = computed(() => this.busqueda().trim() !== '' || this.categoriaFiltro() !== '');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizadorBusqueda);
      this.peticion?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    clearTimeout(this.temporizadorBusqueda);
    this.cargando.set(true);
    this.error.set('');
    this.peticion?.unsubscribe();
    this.peticion = this.productoService.listarMios({ busqueda: this.busqueda() }).subscribe({
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

  buscar(texto: string): void {
    this.busqueda.set(texto);
    clearTimeout(this.temporizadorBusqueda);
    this.temporizadorBusqueda = setTimeout(() => this.cargar(), ESPERA_BUSQUEDA_MS);
  }

  // Vuelve a mostrar todo el catálogo
  limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoriaFiltro.set('');
    this.cargar();
  }
}
