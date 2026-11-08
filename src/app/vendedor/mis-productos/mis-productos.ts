import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { Categoria } from '../../admin/categoria.service';
import { DialogoConfirmacion } from '../../admin/dialogo-confirmacion/dialogo-confirmacion';
import {
  ProductoCatalogo,
  ProductoService,
  formatearPrecio,
  formatearPrecioConDescuento,
  mensajeConfirmarEliminacion,
  mensajeErrorCatalogo,
  mensajeEstadoCambiado,
  mensajeProductoEliminado,
} from '../producto.service';
import {
  FiltroEstado,
  FiltrosCatalogo,
  ValoresFiltros,
  filtrosAParametros,
  filtrosDeParametros,
  mismosParametros,
} from '../filtros-catalogo';

// Espera tras la última tecla antes de pedir al backend: una petición, no una por tecla
const ESPERA_ESCRITURA_MS = 300;

// Listado del catálogo propio: solo los productos del vendedor de la sesión, siempre leídos del backend.
// La búsqueda por nombre y los filtros (categoría, estado y rango de precio) los aplica el backend y se combinan.
// Los filtros se guardan en la dirección de la página, así que se conservan al recargar y al volver
// de un producto.
@Component({
  selector: 'app-mis-productos',
  imports: [RouterLink, FormsModule, DialogoConfirmacion],
  templateUrl: './mis-productos.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './mis-productos.css'],
})
export class MisProductos implements OnInit {
  private productoService = inject(ProductoService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private filtrosCatalogo = inject(FiltrosCatalogo);
  // La primera carga usa los filtros que ya trae la dirección: no hay que reescribirla
  private iniciado = false;

  readonly formatearPrecio = formatearPrecio;
  readonly formatearPrecioConDescuento = formatearPrecioConDescuento;
  readonly mensajeConfirmarEliminacion = mensajeConfirmarEliminacion;

  productos = signal<ProductoCatalogo[]>([]);
  categorias = signal<Categoria[]>([]);
  cargando = signal(false);
  error = signal('');
  exito = signal('');
  // Error al activar, desactivar o eliminar: se muestra sin ocultar la lista
  errorAccion = signal('');
  // Id del producto cuyo estado se está cambiando (desactiva su botón mientras tanto)
  cambiandoEstado = signal<string | null>(null);
  // Producto pendiente de confirmar su eliminación (abre el diálogo)
  productoAEliminar = signal<ProductoCatalogo | null>(null);
  eliminando = signal(false);

  busqueda = signal('');
  idCategoria = signal('');
  estado = signal<FiltroEstado>('');
  precioMinimo = signal<number | null>(null);
  precioMaximo = signal<number | null>(null);

  private temporizador: ReturnType<typeof setTimeout> | undefined;
  // Petición en curso: si cambian los filtros se cancela, para que una respuesta antigua no pise a la nueva
  private peticion: Subscription | undefined;

  hayFiltros = computed(
    () =>
      this.busqueda().trim() !== '' ||
      this.idCategoria() !== '' ||
      this.estado() !== '' ||
      this.precioMinimo() != null ||
      this.precioMaximo() != null,
  );

  // El rango de precio se comprueba antes de pedir nada al backend
  errorFiltros = computed(() => {
    const minimo = this.precioMinimo();
    const maximo = this.precioMaximo();
    if ((minimo != null && minimo < 0) || (maximo != null && maximo < 0)) {
      return 'El precio no puede ser negativo.';
    }
    if (minimo != null && maximo != null && minimo > maximo) {
      return 'El precio mínimo no puede ser mayor que el máximo.';
    }
    return '';
  });

  constructor() {
    // Aviso que dejan el alta de producto y el detalle (tras eliminar un producto) al volver aquí
    const exito = this.router.currentNavigation()?.extras.state?.['exito'];
    if (typeof exito === 'string') {
      this.exito.set(exito);
    }
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
      this.peticion?.unsubscribe();
    });
  }

  ngOnInit(): void {
    // Todas las categorías (endpoint público del registro), para poder filtrar por cualquiera
    this.productoService.listarCategorias().subscribe({
      next: (lista) => this.categorias.set(lista),
      error: () => this.categorias.set([]),
    });
    // Filtros que trae la dirección (al recargar o al volver desde un producto)
    const filtros = filtrosDeParametros(this.route.snapshot.queryParamMap);
    this.busqueda.set(filtros.busqueda);
    this.idCategoria.set(filtros.idCategoria);
    this.estado.set(filtros.estado);
    this.precioMinimo.set(filtros.precioMinimo);
    this.precioMaximo.set(filtros.precioMaximo);
    this.cargar();
    this.iniciado = true;
  }

  cargar(): void {
    clearTimeout(this.temporizador);
    if (this.errorFiltros()) {
      return;
    }
    this.recordarFiltros();
    this.cargando.set(true);
    this.error.set('');
    this.peticion?.unsubscribe();
    const estado = this.estado();
    this.peticion = this.productoService
      .listarMios({
        busqueda: this.busqueda(),
        idCategoria: this.idCategoria(),
        activo: estado === '' ? null : estado === 'activos',
        precioMinimo: this.precioMinimo(),
        precioMaximo: this.precioMaximo(),
      })
      .subscribe({
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

  // Los campos de texto y de precio esperan a que se deje de escribir; los desplegables cargan al momento
  buscar(texto: string): void {
    this.busqueda.set(texto);
    this.cargarAlDejarDeEscribir();
  }

  cambiarPrecioMinimo(precio: number | null): void {
    this.precioMinimo.set(precio);
    this.cargarAlDejarDeEscribir();
  }

  cambiarPrecioMaximo(precio: number | null): void {
    this.precioMaximo.set(precio);
    this.cargarAlDejarDeEscribir();
  }

  cambiarCategoria(idCategoria: string): void {
    this.idCategoria.set(idCategoria);
    this.cargar();
  }

  cambiarEstado(estado: FiltroEstado): void {
    this.estado.set(estado);
    this.cargar();
  }

  // Activar/Desactivar producto. Después se recarga la lista, que respeta los filtros (p. ej. «Solo activos»).
  alternarEstado(producto: ProductoCatalogo): void {
    this.exito.set('');
    this.errorAccion.set('');
    this.cambiandoEstado.set(producto.id);
    this.productoService.cambiarEstado(producto.id, !producto.visible).subscribe({
      next: (actualizado) => {
        this.cambiandoEstado.set(null);
        this.exito.set(mensajeEstadoCambiado(actualizado));
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.cambiandoEstado.set(null);
        this.errorAccion.set(mensajeErrorCatalogo(e));
      },
    });
  }

  // Eliminar producto: primero se pide confirmación; si se cancela, el producto no cambia
  pedirEliminacion(producto: ProductoCatalogo): void {
    this.exito.set('');
    this.errorAccion.set('');
    this.productoAEliminar.set(producto);
  }

  cancelarEliminacion(): void {
    if (!this.eliminando()) {
      this.productoAEliminar.set(null);
    }
  }

  confirmarEliminacion(): void {
    const producto = this.productoAEliminar();
    if (!producto) {
      return;
    }
    this.eliminando.set(true);
    this.productoService.eliminar(producto.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.productoAEliminar.set(null);
        this.exito.set(mensajeProductoEliminado(producto));
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.productoAEliminar.set(null);
        this.errorAccion.set(mensajeErrorCatalogo(e));
        // Si ya no existe (p. ej. se eliminó desde otra pestaña), se recarga para que desaparezca de la lista
        if (e.status === 404) {
          this.cargar();
        }
      },
    });
  }

  // Quita todos los filtros y vuelve a mostrar el catálogo completo
  limpiarFiltros(): void {
    this.busqueda.set('');
    this.idCategoria.set('');
    this.estado.set('');
    this.precioMinimo.set(null);
    this.precioMaximo.set(null);
    this.cargar();
  }

  // Guarda los filtros en la dirección (sin añadir una entrada al historial por cada cambio) y los
  // recuerda para «Volver a mi catálogo» desde la ficha o el formulario
  private recordarFiltros(): void {
    const parametros = filtrosAParametros(this.valoresFiltros());
    this.filtrosCatalogo.ultimos.set(parametros);
    if (this.iniciado && !mismosParametros(parametros, this.route.snapshot.queryParams)) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: parametros,
        replaceUrl: true,
      });
    }
  }

  private valoresFiltros(): ValoresFiltros {
    return {
      busqueda: this.busqueda(),
      idCategoria: this.idCategoria(),
      estado: this.estado(),
      precioMinimo: this.precioMinimo(),
      precioMaximo: this.precioMaximo(),
    };
  }

  private cargarAlDejarDeEscribir(): void {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.cargar(), ESPERA_ESCRITURA_MS);
  }
}
