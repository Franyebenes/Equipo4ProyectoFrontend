import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';
import { switchMap } from 'rxjs';
import { FavoritosService } from '../../cliente/favoritos.service';
import { mensajeDeError } from '../../core/mensaje-error';
import { urlImagen } from '../../vendedor/producto.service';
import { ListaResumen, ListasService, nombreDeListaValido } from '../listas.service';

/**
 * Menú "Guardar en…": una opción por lista para guardar o quitar el producto, y "Nueva lista" para crear una y guardarlo
 * en ella. Con compacto (tarjeta del catálogo) el botón es ⋯ y el menú se abre hacia arriba, dentro de la tarjeta;
 * si no (ficha), es el botón "Añadir a lista" y se abre hacia abajo.
 */
@Component({
  selector: 'app-anadir-a-lista',
  templateUrl: './anadir-a-lista.html',
  styleUrl: './anadir-a-lista.css',
  host: { '[class.compacto]': 'compacto()' },
})
export class AnadirALista {
  readonly productoId = input.required<string>();
  readonly nombreProducto = input('');
  readonly compacto = input(false);
  private readonly servicio = inject(ListasService);
  private readonly favoritos = inject(FavoritosService);
  private readonly elemento = inject(ElementRef<HTMLElement>);
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly listas = signal<ListaResumen[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly creando = signal(false);
  protected readonly nombreNueva = signal('');
  protected readonly urlImagen = urlImagen;

  protected alternar(): void {
    if (this.abierto()) {
      this.cerrar();
      return;
    }
    this.abierto.set(true);
    this.error.set(null);
    this.cargando.set(true);
    // Se cargan al abrir, para no hacer una petición por cada producto de la página
    this.servicio.listar().subscribe({
      next: (listas) => {
        this.listas.set(listas);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  protected cerrar(): void {
    this.abierto.set(false);
    this.creando.set(false);
    this.nombreNueva.set('');
  }

  // Se cierra al pulsar fuera del menú o con Escape
  @HostListener('document:click', ['$event'])
  protected clicFuera(evento: Event): void {
    if (this.abierto() && !this.elemento.nativeElement.contains(evento.target as Node)) {
      this.cerrar();
    }
  }

  @HostListener('document:keydown.escape')
  protected escape(): void {
    if (this.abierto()) {
      this.cerrar();
    }
  }

  protected contiene(lista: ListaResumen): boolean {
    return lista.idProductos.includes(this.productoId());
  }

  protected cambiar(lista: ListaResumen): void {
    this.error.set(null);
    const peticion = this.contiene(lista)
      ? this.servicio.quitarProducto(lista.id, this.productoId())
      : this.servicio.anadirProducto(lista.id, this.productoId());
    peticion.subscribe({
      next: (actualizada) => {
        this.listas.update((todas) => todas.map((l) => (l.id === actualizada.id ? actualizada : l)));
        // Favoritos es la misma lista que el corazón: se repinta para que coincida
        if (actualizada.porDefecto) {
          this.favoritos.cargarIds();
        }
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected crearYAnadir(): void {
    const nombre = this.nombreNueva().trim();
    if (!nombreDeListaValido(nombre)) {
      this.error.set('El nombre solo puede tener letras, números y espacios (máximo 40).');
      return;
    }
    this.error.set(null);
    this.servicio
      .crear(nombre)
      .pipe(switchMap((lista) => this.servicio.anadirProducto(lista.id, this.productoId())))
      .subscribe({
        next: (lista) => {
          this.listas.update((todas) => [...todas, lista]);
          this.nombreNueva.set('');
          this.creando.set(false);
        },
        error: (e) => this.error.set(mensajeDeError(e)),
      });
  }
}
