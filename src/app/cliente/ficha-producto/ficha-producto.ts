import { Component, HostListener, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth.service';
import {
  IMAGEN_POR_DEFECTO,
  formatearPrecio,
  precioFinal,
  textoDescuentoTotal,
  urlImagen,
} from '../../vendedor/producto.service';
import { BotonAnadirCarrito } from '../boton-anadir-carrito/boton-anadir-carrito';
import { BotonFavorito } from '../boton-favorito/boton-favorito';
import { CarritoService } from '../carrito.service';
import { FavoritosService } from '../favoritos.service';
import {
  CatalogoService,
  ProductoDetalle,
  TEXTO_DISPONIBILIDAD,
  mensajeErrorCatalogoCliente,
} from '../catalogo.service';

const ESTADO_NO_ENCONTRADO = 404;
const MENSAJE_NO_DISPONIBLE = 'Este producto no existe o ya no está disponible.';
const ESTRELLAS = 5;
// Unidades que se pueden añadir de una vez al carrito desde la ficha
export const CANTIDAD_MINIMA = 1;
export const CANTIDAD_MAXIMA = 10;

// Si el cliente no puede comprar el producto, el motivo (en lugar del botón «Añadir al carrito»)
export function motivoNoComprar(producto: ProductoDetalle, clientePremium: boolean): string {
  if (producto.disponibilidad === 'AGOTADO') {
    return 'Producto agotado. Vuelve a consultarlo más adelante.';
  }
  if (producto.soloPremium && !clientePremium) {
    return 'Solo disponible para clientes premium.';
  }
  return '';
}

// Estrellas de una puntuación media (de 1 a 5): true = llena, redondeando a la más cercana
export function estrellas(media: number): boolean[] {
  return Array.from({ length: ESTRELLAS }, (_, i) => i < Math.round(media));
}

const FORMATO_MEDIA = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

@Component({
  selector: 'app-ficha-producto',
  imports: [RouterLink, BotonAnadirCarrito, BotonFavorito],
  templateUrl: './ficha-producto.html',
  styleUrl: './ficha-producto.css',
})
export class FichaProducto implements OnInit {
  private readonly catalogoService = inject(CatalogoService);
  private readonly auth = inject(AuthService);
  private readonly carrito = inject(CarritoService);
  private readonly favoritos = inject(FavoritosService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  readonly formatearPrecio = formatearPrecio;
  // « (30 % en total)» cuando tiene los dos descuentos: se suman
  readonly textoDescuentoTotal = textoDescuentoTotal;
  readonly textoDisponibilidad = TEXTO_DISPONIBILIDAD;
  readonly estrellas = estrellas;
  // «Volver al catálogo» recupera la búsqueda y la página que tenía el cliente
  readonly parametrosVolver = this.catalogoService.ultimosParametros();

  readonly premium = computed(() => this.auth.usuario()?.rol === 'PREMIUM');

  producto = signal<ProductoDetalle | null>(null);
  cargando = signal(true);
  error = signal('');
  // Imagen a pantalla completa
  imagenAmpliada = signal(false);
  // Unidades que se añaden al carrito con el botón
  cantidad = signal(CANTIDAD_MINIMA);
  readonly cantidadMinima = CANTIDAD_MINIMA;
  readonly cantidadMaxima = CANTIDAD_MAXIMA;

  readonly imagen = computed(() => urlImagen(this.producto()?.imagen ?? null) ?? IMAGEN_POR_DEFECTO);
  readonly motivoNoComprar = computed(() => {
    const producto = this.producto();
    return producto ? motivoNoComprar(producto, this.premium()) : '';
  });

  constructor() {
    // Cuando se añade al carrito cambia su contador (el de la cabecera): la cantidad vuelve a 1
    effect(() => {
      this.carrito.numeroArticulos();
      untracked(() => this.cantidad.set(CANTIDAD_MINIMA));
    });
  }

  ngOnInit(): void {
    // HU-31: para saber si el corazón va relleno
    this.favoritos.cargarIds();
    this.catalogoService.obtener(this.id).subscribe({
      next: (producto) => {
        this.producto.set(producto);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(e.status === ESTADO_NO_ENCONTRADO ? MENSAJE_NO_DISPONIBLE : mensajeErrorCatalogoCliente(e));
      },
    });
  }

  // Precio que pagaría un cliente premium (para animar al estándar a hacerse premium)
  precioPremium(producto: ProductoDetalle): string {
    return formatearPrecio(precioFinal(producto.precio, producto.descuento, producto.descuentoPremium, true));
  }

  formatearMedia(media: number): string {
    return FORMATO_MEDIA.format(media);
  }

  // − y +: siempre entre 1 y 10 (si no hay tantas unidades, el carrito lo avisa al añadir)
  cambiarCantidad(diferencia: number): void {
    this.cantidad.update((actual) => Math.min(CANTIDAD_MAXIMA, Math.max(CANTIDAD_MINIMA, actual + diferencia)));
  }

  claseDisponibilidad(producto: ProductoDetalle): string {
    return producto.disponibilidad.toLowerCase().replace('_', '-');
  }

  ampliarImagen(): void {
    if (this.producto()?.imagen) {
      this.imagenAmpliada.set(true);
    }
  }

  @HostListener('document:keydown.escape')
  cerrarImagen(): void {
    this.imagenAmpliada.set(false);
  }
}