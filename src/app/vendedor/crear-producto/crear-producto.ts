import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';

import { Categoria } from '../../admin/categoria.service';
import { errorCaracteresNoPermitidos } from '../../core/caracteres-permitidos';
import {
  ProductoCatalogo,
  ProductoModificacion,
  ProductoService,
  formatearPrecio,
  idsDeCategorias,
  mensajeErrorCatalogo,
  mensajeProductoModificado,
} from '../producto.service';

const PRECIO_MINIMO = 0;
const STOCK_MINIMO = 0;
// Mismo rango que el backend y el esquema de la BBDD (precio.descuento)
const DESCUENTO_MINIMO = 0;
const DESCUENTO_MAXIMO = 100;
const TAMANO_MAXIMO_IMAGEN = 1024 * 1024; // 1 MB
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

// HU15.1 - Formulario para que el vendedor de alta un producto en su catalogo propio.
// Modificar producto - El mismo formulario edita un producto existente (ruta productos/:id/editar),
// con las mismas validaciones. Al editar no se muestran el stock ni el estado: se cambian desde la
// ficha del producto.
@Component({
  selector: 'app-crear-producto',
  imports: [FormsModule, RouterLink],
  templateUrl: './crear-producto.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './crear-producto.css'],
})
export class CrearProducto implements OnInit {
  private productoService = inject(ProductoService);
  private router = inject(Router);

  // Id del producto que se edita, o null si es un alta
  readonly idProducto = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly editando = this.idProducto !== null;
  // «Volver» y «Cancelar»: al catálogo en el alta y a la ficha del producto al editar
  readonly rutaVolver =
    this.idProducto === null ? ['/vendedor/productos'] : ['/vendedor/productos', this.idProducto];

  nombre = '';
  descripcion = '';
  precio: number | null = null;
  stock: number | null = null;
  // Por defecto el producto se crea activo (visible para los clientes) y sin descuento
  activo = true;
  descuento: number | null = null;

  categorias = signal<Categoria[]>([]);
  idCategorias = signal<string[]>([]);
  imagen = signal<string | null>(null);
  // Al editar, el formulario espera a tener los datos actuales del producto
  cargando = signal(this.editando);
  errorCarga = signal('');
  guardando = signal(false);
  error = signal('');

  // Las categorias se piden al endpoint publico del registro (el de /api/admin es solo para el administrador)
  ngOnInit(): void {
    if (this.idProducto === null) {
      this.productoService.listarCategorias().subscribe({
        next: (lista) => this.categorias.set(lista),
        error: (e: HttpErrorResponse) => this.error.set(mensajeErrorCatalogo(e)),
      });
      return;
    }
    // Si el producto no es del vendedor, el backend responde 404 y no se muestra el formulario
    forkJoin({
      categorias: this.productoService.listarCategorias(),
      producto: this.productoService.obtenerMio(this.idProducto),
    }).subscribe({
      next: ({ categorias, producto }) => {
        this.categorias.set(categorias);
        this.rellenar(producto, categorias);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(mensajeErrorCatalogo(e));
      },
    });
  }

  alternarCategoria(id: string): void {
    this.idCategorias.update((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  // La imagen se envia como texto (data URL) dentro del mismo JSON del producto.
  seleccionarImagen(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const fichero = input.files?.[0];
    if (!fichero) {
      return;
    }
    if (!TIPOS_IMAGEN.includes(fichero.type) || fichero.size > TAMANO_MAXIMO_IMAGEN) {
      this.error.set('La imagen debe ser JPG, PNG o WEBP y ocupar como máximo 1 MB.');
      input.value = '';
      return;
    }
    this.error.set('');
    const lector = new FileReader();
    lector.onload = () => this.imagen.set(lector.result as string);
    lector.readAsDataURL(fichero);
  }

  quitarImagen(): void {
    this.imagen.set(null);
  }

  // Precio final que verán los clientes con el descuento elegido, o '' si no aplica todavía
  precioConDescuento(): string {
    if (this.precio == null || this.precio <= PRECIO_MINIMO || !this.descuento
        || this.descuento < DESCUENTO_MINIMO || this.descuento > DESCUENTO_MAXIMO) {
      return '';
    }
    return formatearPrecio(this.precio * (1 - this.descuento / 100));
  }

  guardar(): void {
    const fallo = this.validar();
    if (fallo || this.precio == null) {
      this.error.set(fallo);
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    const datos: ProductoModificacion = {
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim(),
      precio: this.precio,
      idCategorias: this.idCategorias(),
      imagen: this.imagen(),
      descuento: this.descuento,
    };
    if (this.idProducto !== null) {
      this.guardarCambios(this.idProducto, datos);
      return;
    }
    this.productoService
      .crear({ ...datos, stock: this.stock ?? STOCK_MINIMO, activo: this.activo })
      .subscribe({
        // Vuelve al listado, donde ya aparece el producto nuevo
        next: () => void this.router.navigateByUrl('/vendedor/productos'),
        error: (e: HttpErrorResponse) => this.mostrarErrorAlGuardar(e),
      });
  }

  // Modificar producto: tras guardar vuelve a la ficha, con los datos nuevos y la confirmación
  private guardarCambios(id: string, datos: ProductoModificacion): void {
    this.productoService.modificar(id, datos).subscribe({
      next: (producto) =>
        void this.router.navigate(['/vendedor/productos', id], {
          state: { exito: mensajeProductoModificado(producto) },
        }),
      error: (e: HttpErrorResponse) => this.mostrarErrorAlGuardar(e),
    });
  }

  private mostrarErrorAlGuardar(e: HttpErrorResponse): void {
    this.guardando.set(false);
    this.error.set(mensajeErrorCatalogo(e));
  }

  // Datos actuales del producto en el formulario (al editar)
  private rellenar(producto: ProductoCatalogo, categorias: Categoria[]): void {
    this.nombre = producto.nombre;
    this.descripcion = producto.descripcion ?? '';
    this.precio = producto.precio;
    this.descuento = producto.descuento;
    this.idCategorias.set(idsDeCategorias(producto.categorias, categorias));
    this.imagen.set(producto.imagen);
  }

  // Mismas reglas que el backend. Devuelve el error o '' si se puede guardar.
  // El stock solo se pide en el alta.
  private validar(): string {
    const faltaStock = !this.editando && this.stock == null;
    if (!this.nombre.trim() || !this.descripcion.trim() || this.precio == null || faltaStock
        || this.idCategorias().length === 0) {
      return 'Rellena todos los campos obligatorios (*).';
    }
    const falloCaracteres = errorCaracteresNoPermitidos(this.nombre.trim(), this.descripcion.trim());
    if (falloCaracteres) {
      return falloCaracteres;
    }
    const stockValido = this.editando
      || (this.stock != null && this.stock >= STOCK_MINIMO && Number.isInteger(this.stock));
    if (this.precio <= PRECIO_MINIMO || !stockValido) {
      return this.editando
        ? 'El precio debe ser mayor que 0.'
        : 'El precio debe ser mayor que 0 y el stock un número entero no negativo.';
    }
    if (this.descuento != null && (this.descuento < DESCUENTO_MINIMO || this.descuento > DESCUENTO_MAXIMO)) {
      return 'El descuento debe estar entre 0 y 100 %.';
    }
    return '';
  }
}
