import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { Categoria } from '../../admin/categoria.service';
import { AuthService } from '../../core/auth.service';
import { ProductoService } from '../../vendedor/producto.service';
import { FavoritosService } from '../favoritos.service';
import { TarjetaProducto } from '../tarjeta-producto/tarjeta-producto';
import {
  CatalogoService,
  FILTROS_VACIOS,
  FiltrosCatalogo,
  ProductoCliente,
  VALORACIONES,
  filtrosAParametros,
  filtrosDeParametros,
  hayFiltros,
  mensajeErrorCatalogoCliente,
  validarFiltros,
} from '../catalogo.service';

const PRIMERA_PAGINA = 0;
// Al escribir un precio se filtra cuando se deja de teclear este tiempo (una petición, no una por tecla)
export const ESPERA_PRECIO_MS = 500;
// Categorías que se ven como botones; el resto, en el desplegable «Más categorías»
export const CATEGORIAS_VISIBLES = 6;
// En la dirección las páginas empiezan en 1 (?pagina=2 es la segunda); en el backend, en 0
const DESFASE_PAGINA_URL = 1;

type CampoPrecio = 'precioMinimo' | 'precioMaximo';

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, TarjetaProducto],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class Catalogo implements OnInit {
  private readonly catalogoService = inject(CatalogoService);
  private readonly productoService = inject(ProductoService);
  private readonly favoritos = inject(FavoritosService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly valoraciones = VALORACIONES;

  readonly premium = computed(() => this.auth.usuario()?.rol === 'PREMIUM');

  productos = signal<ProductoCliente[]>([]);
  categorias = signal<Categoria[]>([]);
  pagina = signal(PRIMERA_PAGINA);
  totalPaginas = signal(0);
  totalElementos = signal(0);
  cargando = signal(false);
  error = signal('');
  // HU-20: filtros que no tienen sentido (no se busca hasta corregirlos)
  errorFiltros = signal('');
  // Lo que escribe el cliente en el buscador (se aplica al pulsar Intro o «Buscar»)
  busqueda = signal('');
  // Búsqueda y filtros con los que se ha cargado lo que se ve (para el resumen y el mensaje de «sin resultados»)
  filtros = signal<FiltrosCatalogo>(FILTROS_VACIOS);

  readonly hayFiltros = computed(() => hayFiltros(this.filtros()));

  // HU-20: las primeras categorías como botones y, si la elegida es de las demás, también se ve como botón al final
  readonly categoriasVisibles = computed(() => {
    const visibles = this.categorias().slice(0, CATEGORIAS_VISIBLES);
    const elegida = this.categorias().find((c) => c.id === this.filtros().idCategoria);
    return elegida && !visibles.includes(elegida) ? [...visibles, elegida] : visibles;
  });
  readonly categoriasDesplegable = computed(() => {
    const visibles = this.categoriasVisibles();
    return this.categorias().filter((c) => !visibles.includes(c));
  });
  readonly hayBusquedaOFiltros = computed(() => this.filtros().busqueda !== '' || this.hayFiltros());

  // «12 productos para «taza»»: cuántos hay con la búsqueda y los filtros aplicados
  readonly textoResumen = computed(() => {
    const total = this.totalElementos();
    const busqueda = this.filtros().busqueda;
    return `${total} ${total === 1 ? 'producto' : 'productos'}${busqueda ? ` para «${busqueda}»` : ''}`;
  });

  // Mensaje cuando ningún producto cumple la búsqueda y los filtros
  readonly textoSinResultados = computed(() => {
    const busqueda = this.filtros().busqueda;
    if (busqueda && this.hayFiltros()) {
      return `No hay productos que coincidan con «${busqueda}» y los filtros elegidos.`;
    }
    return busqueda
      ? `No hay productos que coincidan con «${busqueda}».`
      : 'No hay productos que coincidan con los filtros elegidos.';
  });

  // Números de página para la paginación (se muestran empezando en 1)
  readonly paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i));

  // Petición en curso: si se busca otra cosa se cancela, para que una respuesta antigua no pise a la nueva
  private peticion: Subscription | undefined;
  private temporizadorPrecio: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizadorPrecio);
      this.peticion?.unsubscribe();
    });
  }

  // La búsqueda, los filtros y la página vienen en la dirección: al volver de una ficha o recargar, se ve lo mismo
  ngOnInit(): void {
    // HU-31: para pintar el corazón relleno en los productos favoritos
    this.favoritos.cargarIds();
    // Categorías para la navegación por categorías (endpoint público)
    this.productoService.listarCategorias().subscribe({
      next: (lista) => this.categorias.set(lista),
      error: () => this.categorias.set([]),
    });
    const parametros = this.route.snapshot.queryParamMap;
    const filtros = filtrosDeParametros(parametros);
    this.busqueda.set(filtros.busqueda);
    this.filtros.set(filtros);
    const paginaUrl = Number(parametros.get('pagina'));
    const pagina = Number.isInteger(paginaUrl) && paginaUrl > PRIMERA_PAGINA ? paginaUrl - DESFASE_PAGINA_URL : PRIMERA_PAGINA;
    this.cargar(pagina);
  }

  // Cada búsqueda o filtro nuevo vuelve a la primera página
  buscar(): void {
    this.aplicar({ busqueda: this.busqueda().trim() });
  }

  elegirCategoria(idCategoria: string): void {
    this.aplicar({ idCategoria });
  }

  // Pulsar la categoría elegida la quita (vuelven todas); pulsar otra la elige
  alternarCategoria(idCategoria: string): void {
    this.elegirCategoria(this.filtros().idCategoria === idCategoria ? '' : idCategoria);
  }

  // Desplegable «Más categorías»: elige la categoría y el desplegable vuelve a su texto
  elegirDelDesplegable(evento: Event): void {
    const desplegable = evento.target as HTMLSelectElement;
    if (desplegable.value) {
      this.elegirCategoria(desplegable.value);
    }
    desplegable.value = '';
  }

  // Precio: se filtra solo al dejar de escribir y, sin esperar, al pulsar Intro o salir del campo. Vacío, sin límite.
  escribirPrecio(campo: CampoPrecio, evento: Event): void {
    const precio = this.precioDe(evento);
    clearTimeout(this.temporizadorPrecio);
    this.temporizadorPrecio = setTimeout(() => this.aplicarPrecio(campo, precio), ESPERA_PRECIO_MS);
  }

  confirmarPrecio(campo: CampoPrecio, evento: Event): void {
    clearTimeout(this.temporizadorPrecio);
    this.aplicarPrecio(campo, this.precioDe(evento));
  }

  cambiarPrecioMinimo(precio: number | null): void {
    this.aplicarPrecio('precioMinimo', precio);
  }

  cambiarPrecioMaximo(precio: number | null): void {
    this.aplicarPrecio('precioMaximo', precio);
  }

  cambiarValoracion(valoracion: string): void {
    this.aplicar({ valoracionMinima: valoracion ? Number(valoracion) : null });
  }

  cambiarSoloDisponibles(soloDisponibles: boolean): void {
    this.aplicar({ soloDisponibles });
  }

  // Quita los filtros, pero no la búsqueda por nombre
  limpiarFiltros(): void {
    this.aplicar({ ...FILTROS_VACIOS, busqueda: this.filtros().busqueda });
  }

  // Quita la búsqueda y los filtros: todo el catálogo
  verTodo(): void {
    this.busqueda.set('');
    this.aplicar(FILTROS_VACIOS);
  }

  irAPagina(pagina: number): void {
    if (pagina < PRIMERA_PAGINA || pagina >= this.totalPaginas() || pagina === this.pagina()) {
      return;
    }
    this.cargar(pagina);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Valor de un campo de precio: vacío o no numérico, sin límite
  precioDe(evento: Event): number | null {
    const texto = (evento.target as HTMLInputElement).value;
    return texto === '' || !Number.isFinite(Number(texto)) ? null : Number(texto);
  }

  cargar(pagina: number): void {
    const filtros = this.filtros();
    const fallo = validarFiltros(filtros);
    this.errorFiltros.set(fallo);
    if (fallo) {
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.peticion?.unsubscribe();
    this.peticion = this.catalogoService.buscar(filtros, pagina).subscribe({
      next: (resultado) => {
        this.productos.set(resultado.contenido);
        this.pagina.set(resultado.pagina);
        this.totalPaginas.set(resultado.totalPaginas);
        this.totalElementos.set(resultado.totalElementos);
        this.recordarParametros(filtros, resultado.pagina);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorCatalogoCliente(e));
      },
    });
  }

  // Si el precio no ha cambiado (por ejemplo, al salir del campo después de que ya se aplicara) no se vuelve a buscar
  private aplicarPrecio(campo: CampoPrecio, precio: number | null): void {
    if (this.filtros()[campo] !== precio) {
      this.aplicar({ [campo]: precio });
    }
  }

  private aplicar(cambios: Partial<FiltrosCatalogo>): void {
    this.filtros.update((filtros) => ({ ...filtros, ...cambios }));
    this.cargar(PRIMERA_PAGINA);
  }

  // Guarda la búsqueda, los filtros y la página en la dirección (sin añadir una entrada al historial) y para
  // «Volver al catálogo» desde la ficha
  private recordarParametros(filtros: FiltrosCatalogo, pagina: number): void {
    const parametros = filtrosAParametros(filtros);
    if (pagina > PRIMERA_PAGINA) {
      parametros.pagina = pagina + DESFASE_PAGINA_URL;
    }
    this.catalogoService.ultimosParametros.set(parametros);
    void this.router.navigate([], { relativeTo: this.route, queryParams: parametros, replaceUrl: true });
  }
}