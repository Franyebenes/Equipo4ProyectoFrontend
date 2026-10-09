import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { Categoria, CategoriaService } from '../../admin/categoria.service';
import { ProductoService, mensajeErrorCatalogo } from '../producto.service';

const PRECIO_MINIMO = 0;
const STOCK_MINIMO = 0;
const TAMANO_MAXIMO_IMAGEN = 1024 * 1024; // 1 MB
const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];

// HU15.1 - Formulario para que el vendedor de alta un producto en su catalogo propio.
@Component({
  selector: 'app-crear-producto',
  imports: [FormsModule, RouterLink],
  templateUrl: './crear-producto.html',
  styleUrls: ['../../admin/admin-shared.css', '../vendedor-shared.css', './crear-producto.css'],
})
export class CrearProducto implements OnInit {
  private productoService = inject(ProductoService);
  private categoriaService = inject(CategoriaService);
  private router = inject(Router);

  nombre = '';
  descripcion = '';
  precio: number | null = null;
  stock: number | null = null;

  categorias = signal<Categoria[]>([]);
  idCategorias = signal<string[]>([]);
  imagen = signal<string | null>(null);
  guardando = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.categoriaService.listar().subscribe({
      next: (lista) => this.categorias.set(lista),
      error: (e: HttpErrorResponse) => this.error.set(mensajeErrorCatalogo(e)),
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

  guardar(): void {
    if (!this.nombre.trim() || !this.descripcion.trim() || this.precio == null || this.stock == null
        || this.idCategorias().length === 0) {
      this.error.set('Rellena todos los campos obligatorios (*).');
      return;
    }
    if (this.precio <= PRECIO_MINIMO || this.stock < STOCK_MINIMO || !Number.isInteger(this.stock)) {
      this.error.set('El precio debe ser mayor que 0 y el stock un número entero no negativo.');
      return;
    }

    this.guardando.set(true);
    this.error.set('');
    this.productoService
      .crear({
        nombre: this.nombre.trim(),
        descripcion: this.descripcion.trim(),
        precio: this.precio,
        idCategorias: this.idCategorias(),
        stock: this.stock,
        imagen: this.imagen(),
      })
      .subscribe({
        // Vuelve al listado, donde ya aparece el producto nuevo
        next: () => void this.router.navigateByUrl('/vendedor/productos'),
        error: (e: HttpErrorResponse) => {
          this.guardando.set(false);
          this.error.set(mensajeErrorCatalogo(e));
        },
      });
  }
}