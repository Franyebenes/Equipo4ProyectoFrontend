import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IMAGEN_POR_DEFECTO, formatearPrecio, urlImagen } from '../../vendedor/producto.service';
import { BotonFavorito } from '../boton-favorito/boton-favorito';
import {
  Disponibilidad,
  ProductoCliente,
  TEXTO_DISPONIBILIDAD,
  formatearValoracion,
  tieneDescuento,
} from '../catalogo.service';

// Tarjeta de un producto (foto, nombre, categorías, precio, valoración y disponibilidad), la misma en el catálogo y en
// la lista de favoritos. Toda la tarjeta lleva a la ficha; el corazón, arriba a la derecha de la foto, lo marca como
// favorito.
@Component({
  selector: 'app-tarjeta-producto',
  imports: [RouterLink, BotonFavorito],
  templateUrl: './tarjeta-producto.html',
  styleUrl: './tarjeta-producto.css',
})
export class TarjetaProducto {
  readonly producto = input.required<ProductoCliente>();
  // true al añadirlo a favoritos y false al quitarlo
  readonly cambioFavorito = output<boolean>();

  readonly formatearPrecio = formatearPrecio;
  readonly formatearValoracion = formatearValoracion;
  readonly urlImagen = urlImagen;
  readonly tieneDescuento = tieneDescuento;
  readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;
  readonly textoDisponibilidad = TEXTO_DISPONIBILIDAD;

  claseDisponibilidad(disponibilidad: Disponibilidad): string {
    return disponibilidad.toLowerCase().replace('_', '-');
  }
}