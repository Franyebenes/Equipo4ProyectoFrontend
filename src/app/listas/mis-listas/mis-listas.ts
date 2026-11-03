import { Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { mensajeDeError } from '../../core/mensaje-error';
import { IMAGEN_POR_DEFECTO, urlImagen } from '../../vendedor/producto.service';
import { ListaDetalle, ListaResumen, ListasService, ProductoEnLista, nombreDeListaValido } from '../listas.service';

const NOMBRE_NO_VALIDO = 'El nombre solo puede tener letras, números y espacios (máximo 40).';

/**
 * "Mis listas", como las colecciones de Instagram: en /listas, una cuadrícula de colecciones con el mosaico de sus
 * últimos productos; en /listas/:id, los productos de una colección.
 */
@Component({
  selector: 'app-mis-listas',
  imports: [RouterLink],
  templateUrl: './mis-listas.html',
  styleUrls: ['../../cliente/catalogo/catalogo.css', './mis-listas.css'],
})
export class MisListas {
  private readonly servicio = inject(ListasService);
  private readonly router = inject(Router);
  protected readonly idAbierta = toSignal(inject(ActivatedRoute).paramMap.pipe(map((p) => p.get('id'))));

  protected readonly cargando = signal(true);
  protected readonly listas = signal<ListaResumen[]>([]);
  protected readonly seleccionada = signal<ListaDetalle | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly creando = signal(false);
  protected readonly nombreNueva = signal('');
  protected readonly renombrando = signal(false);
  protected readonly nombreEditado = signal('');
  protected readonly confirmandoBorrado = signal(false);
  protected readonly formatoPrecio = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  protected readonly urlImagen = urlImagen;
  protected readonly imagenPorDefecto = IMAGEN_POR_DEFECTO;

  constructor() {
    // Al cambiar la ruta se enseña la cuadrícula de colecciones o la colección abierta
    effect(() => {
      const id = this.idAbierta();
      this.error.set(null);
      this.renombrando.set(false);
      this.confirmandoBorrado.set(false);
      this.seleccionada.set(null);
      if (id) {
        this.abrir(id);
      } else {
        this.cargarListas();
      }
    });
  }

  private cargarListas(): void {
    this.cargando.set(true);
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

  private abrir(id: string): void {
    this.cargando.set(true);
    this.servicio.obtener(id).subscribe({
      next: (detalle) => {
        this.seleccionada.set(detalle);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(mensajeDeError(e));
        this.cargando.set(false);
      },
    });
  }

  /** Huecos del mosaico 2×2: las portadas que haya y el resto vacíos. */
  protected mosaico(lista: ListaResumen): (string | null)[] {
    return [0, 1, 2, 3].map((i) => urlImagen(lista.portadas[i] ?? null));
  }

  protected crear(): void {
    const nombre = this.nombreNueva().trim();
    if (!nombreDeListaValido(nombre)) {
      this.error.set(NOMBRE_NO_VALIDO);
      return;
    }
    this.error.set(null);
    this.servicio.crear(nombre).subscribe({
      next: () => {
        this.nombreNueva.set('');
        this.creando.set(false);
        this.cargarListas();
      },
      error: (e) => this.error.set(mensajeDeError(e)), // 409 si el nombre ya existe o se ha llegado al límite
    });
  }

  protected cancelarCrear(): void {
    this.creando.set(false);
    this.nombreNueva.set('');
  }

  protected empezarRenombrar(lista: ListaDetalle): void {
    this.nombreEditado.set(lista.nombre);
    this.confirmandoBorrado.set(false);
    this.renombrando.set(true);
  }

  protected guardarNombre(lista: ListaDetalle): void {
    const nombre = this.nombreEditado().trim();
    if (!nombreDeListaValido(nombre)) {
      this.error.set(NOMBRE_NO_VALIDO);
      return;
    }
    this.error.set(null);
    this.servicio.renombrar(lista.id, nombre).subscribe({
      next: (renombrada) => {
        this.seleccionada.set({ ...lista, nombre: renombrada.nombre });
        this.renombrando.set(false);
      },
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected eliminar(lista: ListaDetalle): void {
    this.error.set(null);
    this.servicio.eliminar(lista.id).subscribe({
      next: () => this.router.navigate(['/listas']),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected quitar(lista: ListaDetalle, producto: ProductoEnLista): void {
    this.error.set(null);
    this.servicio.quitarProducto(lista.id, producto.id).subscribe({
      next: () => this.seleccionada.set({ ...lista, productos: lista.productos.filter((p) => p.id !== producto.id) }),
      error: (e) => this.error.set(mensajeDeError(e)),
    });
  }

  protected precio(valor: number | null): string {
    return valor == null ? '—' : this.formatoPrecio.format(valor);
  }
}
