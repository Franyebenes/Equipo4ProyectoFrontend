import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductoCliente, mensajeErrorCatalogoCliente } from '../catalogo.service';
import { FavoritosService } from '../favoritos.service';
import { TarjetaProducto } from '../tarjeta-producto/tarjeta-producto';

// HU-31.1 Ver lista de favoritos: los productos que el cliente ha marcado, en tarjetas como las del catálogo. Desde
// cada una se abre su ficha, y con el corazón se quita de la lista al momento (HU-31.3).
@Component({
  selector: 'app-favoritos',
  imports: [RouterLink, TarjetaProducto],
  templateUrl: './favoritos.html',
  styleUrls: ['../catalogo/catalogo.css', './favoritos.css'],
})
export class Favoritos implements OnInit {
  private readonly favoritos = inject(FavoritosService);

  productos = signal<ProductoCliente[]>([]);
  cargando = signal(true);
  error = signal('');

  // Siempre se piden al backend: la lista refleja lo último que se ha añadido o quitado
  ngOnInit(): void {
    this.favoritos.cargarIds();
    this.favoritos.listar().subscribe({
      next: (productos) => {
        this.productos.set(productos);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeErrorCatalogoCliente(e));
      },
    });
  }

  // Al quitarlo con el corazón deja de verse en la lista
  cambioFavorito(producto: ProductoCliente, esFavorito: boolean): void {
    if (!esFavorito) {
      this.productos.update((lista) => lista.filter((p) => p.id !== producto.id));
    }
  }
}