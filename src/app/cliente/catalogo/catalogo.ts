import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { IMAGEN_POR_DEFECTO, formatearPrecio, urlImagen } from '../../vendedor/producto.service';
import {
  CatalogoService,
  Disponibilidad,
  ProductoCliente,
  TEXTO_DISPONIBILIDAD,
  mensajeErrorCatalogoCliente,
  tieneDescuento,
} from '../catalogo.service';

const PRIMERA_PAGINA = 0;

@Component({
  selector: 'app-catalogo',
  imports: [FormsModule],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css',
})
export class Catalogo implements OnInit {
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);

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

  ngOnInit(): void {
    this.cargar(PRIMERA_PAGINA);
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
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorCatalogoCliente(e));
      },
    });
  }
}