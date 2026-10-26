import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';

import { FavoritosService, mensajeErrorFavoritos } from '../favoritos.service';

// Tiempo que se ve el mensaje de error junto al corazón
const DURACION_ERROR_MS = 4000;

// HU-31.2 y HU-31.3 Corazón para añadir o quitar un producto de favoritos: vacío si no lo es y rojo si lo es. Se usa
// en la tarjeta del catálogo, en la ficha y en la lista de favoritos:
//   <app-boton-favorito [idProducto]="p.id" [nombre]="p.nombre" />
@Component({
  selector: 'app-boton-favorito',
  templateUrl: './boton-favorito.html',
  styleUrl: './boton-favorito.css',
})
export class BotonFavorito {
  private readonly favoritos = inject(FavoritosService);

  readonly idProducto = input.required<string>();
  readonly nombre = input('');
  // true al añadirlo y false al quitarlo (la lista de favoritos lo usa para quitar la tarjeta)
  readonly cambio = output<boolean>();

  readonly favorito = computed(() => this.favoritos.ids().has(this.idProducto()));
  readonly enviando = signal(false);
  readonly error = signal('');
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
  }

  alternar(evento: Event): void {
    // Está encima del enlace a la ficha: pulsar el corazón no debe abrirla
    evento.preventDefault();
    evento.stopPropagation();
    if (this.enviando()) {
      return;
    }
    const anadir = !this.favorito();
    const peticion = anadir
      ? this.favoritos.anadir(this.idProducto())
      : this.favoritos.quitar(this.idProducto());
    this.enviando.set(true);
    this.error.set('');
    peticion.subscribe({
      next: () => {
        this.enviando.set(false);
        this.cambio.emit(anadir);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.mostrarError(mensajeErrorFavoritos(e));
        // Ya estaba o ya no estaba (por ejemplo, desde otra pestaña): se vuelve a leer cómo está de verdad
        this.favoritos.cargarIds();
      },
    });
  }

  private mostrarError(mensaje: string): void {
    this.error.set(mensaje);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.error.set(''), DURACION_ERROR_MS);
  }
}