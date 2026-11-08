import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';

import { mensajeDeError } from '../../core/mensaje-error';
import {
  FILTROS_VACIOS,
  FiltrosCatalogo,
  VALORACIONES,
  formatearValoracion,
  hayFiltros,
  validarFiltros,
} from '../../cliente/catalogo.service';
import { IMAGEN_POR_DEFECTO, ProductoService, urlImagen } from '../../vendedor/producto.service';
import { Categoria } from '../categoria.service';
import { Pagina, ProductoAdmin, ProductoAdminService } from '../producto-admin.service';

const ESPERA_PRECIO_MS = 500;
const CATEGORIAS_VISIBLES = 6;

type CampoPrecio = 'precioMinimo' | 'precioMaximo';

/**
 * Todos los productos de la plataforma con la foto y los filtros del catálogo de los clientes, en modo lectura: sin
 * acciones para editar, desactivar ni borrar. También muestra los desactivados, que los clientes no ven.
 */
@Component({
  selector: 'app-ver-productos-admin',
  imports: [RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './ver-productos-admin.html',
  styleUrls: ['../admin-shared.css', './ver-productos-admin.css'],
})
export class VerProductosAdmin {
  private readonly servicio = inject(ProductoAdminService);
  private readonly productoService = inject(ProductoService);

  protected readonly valoraciones = VALORACIONES;
  protected readonly urlImagen = urlImagen;
  protected readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;
  protected readonly formatearValoracion = formatearValoracion;
  protected readonly formatoPrecio = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

  protected readonly pagina = signal<Pagina<ProductoAdmin> | null>(null);
  protected readonly categorias = signal<Categoria[]>([]);
  protected readonly cargando = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly errorFiltros = signal('');
  protected readonly busqueda = signal('');
  protected readonly filtros = signal<FiltrosCatalogo>(FILTROS_VACIOS);

  protected readonly hayFiltros = computed(() => hayFiltros(this.filtros()));
  protected readonly hayBusquedaOFiltros = computed(() => this.filtros().busqueda !== '' || this.hayFiltros());

  // Las primeras categorías como botones; si la elegida es de las demás, también se ve como botón al final
  protected readonly categoriasVisibles = computed(() => {
    const visibles = this.categorias().slice(0, CATEGORIAS_VISIBLES);
    const elegida = this.categorias().find((c) => c.id === this.filtros().idCategoria);
    return elegida && !visibles.includes(elegida) ? [...visibles, elegida] : visibles;
  });
  protected readonly categoriasDesplegable = computed(() => {
    const visibles = this.categoriasVisibles();
    return this.categorias().filter((c) => !visibles.includes(c));
  });

  // Si se busca otra cosa se cancela la petición en curso, para que una respuesta antigua no pise a la nueva
  private peticion: Subscription | undefined;
  private temporizadorPrecio: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizadorPrecio);
      this.peticion?.unsubscribe();
    });
    this.productoService.listarCategorias().subscribe({
      next: (lista) => this.categorias.set(lista),
      error: () => this.categorias.set([]),
    });
    const anterior = this.servicio.ultimoListado;
    if (anterior) {
      this.filtros.set(anterior.filtros);
      this.busqueda.set(anterior.filtros.busqueda);
    }
    this.cargar(anterior?.pagina ?? 0);
  }

  protected cargar(numero: number): void {
    const filtros = this.filtros();
    const fallo = validarFiltros(filtros);
    this.errorFiltros.set(fallo);
    if (fallo) {
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.peticion?.unsubscribe();
    this.peticion = this.servicio.listar(filtros, numero).subscribe({
      next: (p) => {
        this.pagina.set(p);
        this.servicio.ultimoListado = { filtros, pagina: p.pagina };
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected buscar(): void {
    this.aplicar({ busqueda: this.busqueda().trim() });
  }

  protected alternarCategoria(idCategoria: string): void {
    this.aplicar({ idCategoria: this.filtros().idCategoria === idCategoria ? '' : idCategoria });
  }

  protected elegirDelDesplegable(evento: Event): void {
    const desplegable = evento.target as HTMLSelectElement;
    if (desplegable.value) {
      this.aplicar({ idCategoria: desplegable.value });
    }
    desplegable.value = '';
  }

  // El precio se filtra al dejar de escribir y, sin esperar, al pulsar Intro o salir del campo
  protected escribirPrecio(campo: CampoPrecio, evento: Event): void {
    const precio = this.precioDe(evento);
    clearTimeout(this.temporizadorPrecio);
    this.temporizadorPrecio = setTimeout(() => this.aplicarPrecio(campo, precio), ESPERA_PRECIO_MS);
  }

  protected confirmarPrecio(campo: CampoPrecio, evento: Event): void {
    clearTimeout(this.temporizadorPrecio);
    this.aplicarPrecio(campo, this.precioDe(evento));
  }

  protected cambiarValoracion(valoracion: string): void {
    this.aplicar({ valoracionMinima: valoracion ? Number(valoracion) : null });
  }

  protected cambiarSoloDisponibles(soloDisponibles: boolean): void {
    this.aplicar({ soloDisponibles });
  }

  protected limpiarFiltros(): void {
    this.aplicar({ ...FILTROS_VACIOS, busqueda: this.filtros().busqueda });
  }

  protected verTodo(): void {
    this.busqueda.set('');
    this.aplicar(FILTROS_VACIOS);
  }

  protected precio(valor: number | null): string {
    return valor == null ? '—' : this.formatoPrecio.format(valor);
  }

  private precioDe(evento: Event): number | null {
    const texto = (evento.target as HTMLInputElement).value;
    return texto === '' || !Number.isFinite(Number(texto)) ? null : Number(texto);
  }

  private aplicarPrecio(campo: CampoPrecio, precio: number | null): void {
    if (this.filtros()[campo] !== precio) {
      this.aplicar({ [campo]: precio });
    }
  }

  // Cada búsqueda o filtro nuevo vuelve a la primera página
  private aplicar(cambios: Partial<FiltrosCatalogo>): void {
    this.filtros.update((filtros) => ({ ...filtros, ...cambios }));
    this.cargar(0);
  }
}
