import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { mensajeError } from '../admin.service';
import { Categoria, CategoriaService } from '../categoria.service';

@Component({
  selector: 'app-crear-categoria',
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './crear-categoria.html',
  styleUrls: ['../admin-shared.css', './crear-categoria.css'],
})
export class CrearCategoriaComponent {
  private categoriaService = inject(CategoriaService);

  datos: Omit<Categoria, 'id'> = { nombre: '', descripcion: '' };
  enviando = signal(false);
  error = signal('');
  exito = signal('');

  enviar(): void {
    this.error.set('');
    this.exito.set('');

    const nombre = this.datos.nombre.trim();
    const descripcion = this.datos.descripcion.trim();

    if (!nombre || !descripcion) {
      this.error.set('Rellena todos los campos obligatorios (*).');
      return;
    }
    if (nombre.length > 50) {
      this.error.set('El nombre no puede superar los 50 caracteres.');
      return;
    }
    if (descripcion.length > 200) {
      this.error.set('La descripción no puede superar los 200 caracteres.');
      return;
    }

    this.enviando.set(true);
    this.categoriaService.crear({ nombre, descripcion }).subscribe({
      next: (c) => {
        this.enviando.set(false);
        this.datos = { nombre: '', descripcion: '' };
        this.exito.set(`Categoría "${c.nombre}" creada correctamente.`);
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }
}