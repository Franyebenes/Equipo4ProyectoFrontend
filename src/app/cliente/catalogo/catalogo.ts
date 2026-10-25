import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { IMAGEN_POR_DEFECTO, formatearPrecio, urlImagen } from '../../vendedor/producto.service';
import {
  CatalogoService,
  Disponibilidad,
  ParametrosCatalogo,
  ProductoCliente,
  TEXTO_DISPONIBILIDAD,
  mensajeErrorCatalogoCliente,
  tieneDescuento,
} from '../catalogo.service';

const PRIMERA_PAGINA = 0;
// En la dirección las páginas empiezan en 1 (?pagina=2 es la segunda); en el backend, en 0
const DESFASE_PAGINA_URL = 1;

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule, RouterLink],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class Catalogo implements OnInit {
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly formatearPrecio = formatearPrecio;
  readonly urlImagen = urlImagen;
  readonly tieneDescuento = tieneDescuento;
  readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;
  readonly textoDisponibilidad = TEXTO_DISPONIBILIDAD;

  readonly premium = computed(() => this.auth.usuario()?.rol === 'PREMIUM');

  productos = signal<ProductoCliente[]>([]);
  pagina = signal(PRIMERA_PAGINA);
  totalPaginas = signal(0);
  totalElementos = signal(0);
  cargando = signal(false);
  error = signal('');
  // Lo que escribe el cliente y lo que se ha buscado de verdad (para el mensaje de «sin resultados»)
  busqueda = signal('');
  busquedaAplicada = signal('');

  // Números de página para la paginación (se muestran empezando en 1)
  readonly paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i));

  // Petición en curso: si se busca otra cosa se cancela, para que una respuesta antigua no pise a la nueva
  private peticion: Subscription | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.peticion?.unsubscribe());
  }

  // La búsqueda y la página vienen en la dirección: al volver de una ficha o recargar, se ve lo mismo que antes
  ngOnInit(): void {
    const parametros = this.route.snapshot.queryParamMap;
    this.busqueda.set(parametros.get('busqueda') ?? '');
    const paginaUrl = Number(parametros.get('pagina'));
    const pagina = Number.isInteger(paginaUrl) && paginaUrl > PRIMERA_PAGINA ? paginaUrl - DESFASE_PAGINA_URL : PRIMERA_PAGINA;
    this.cargar(pagina);
  }

  // Cada búsqueda nueva vuelve a la primera página
  buscar(): void {
    this.cargar(PRIMERA_PAGINA);
  }

  limpiarBusqueda(): void {
    this.busqueda.set('');
    this.cargar(PRIMERA_PAGINA);
  }

  irAPagina(pagina: number): void {
    if (pagina < PRIMERA_PAGINA || pagina >= this.totalPaginas() || pagina === this.pagina()) {
      return;
    }
    this.cargar(pagina);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  claseDisponibilidad(disponibilidad: Disponibilidad): string {
    return disponibilidad.toLowerCase().replace('_', '-');
  }

  cargar(pagina: number): void {
    const busqueda = this.busqueda().trim();
    this.cargando.set(true);
    this.error.set('');
    this.peticion?.unsubscribe();
    this.peticion = this.catalogoService.buscar(busqueda, pagina).subscribe({
      next: (resultado) => {
        this.productos.set(resultado.contenido);
        this.pagina.set(resultado.pagina);
        this.totalPaginas.set(resultado.totalPaginas);
        this.totalElementos.set(resultado.totalElementos);
        this.busquedaAplicada.set(busqueda);
        this.recordarParametros(busqueda, resultado.pagina);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorCatalogoCliente(e));
      },
    });
  }

  // Guarda la búsqueda y la página en la dirección (sin añadir una entrada al historial) y para «Volver al catálogo»
  private recordarParametros(busqueda: string, pagina: number): void {
    const parametros: ParametrosCatalogo = {};
    if (busqueda) {
      parametros.busqueda = busqueda;
    }
    if (pagina > PRIMERA_PAGINA) {
      parametros.pagina = pagina + DESFASE_PAGINA_URL;
    }
    this.catalogoService.ultimosParametros.set(parametros);
    void this.router.navigate([], { relativeTo: this.route, queryParams: parametros, replaceUrl: true });
  }
}