import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { mensajeError } from '../admin.service';
import { Categoria, CategoriaService } from '../categoria.service';
import { DialogoConfirmacion } from '../dialogo-confirmacion/dialogo-confirmacion';

@Component({
  selector: 'app-ver-categorias',
    imports: [RouterLink, RouterLinkActive, DialogoConfirmacion],
  templateUrl: './ver-categorias.html',
    styleUrls: ['../admin-shared.css', './ver-categorias.css'],
})
export class VerCategorias implements OnInit {
  private categoriaService = inject(CategoriaService);

  categorias = signal<Categoria[]>([]);
  cargando = signal(false);
  error = signal('');
  categoriaAEliminar = signal<Categoria | null>(null);
  eliminando = signal(false);
  exito = signal('');
  errorEliminar = signal('');

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.categoriaService.listar().subscribe({
      next: (lista) => {
        this.categorias.set(lista);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }

    pedirConfirmacion(categoria: Categoria): void {
    this.categoriaAEliminar.set(categoria);
  }

  cancelarEliminacion(): void {
    if (!this.eliminando()) {
      this.categoriaAEliminar.set(null);
    }
  }


    confirmarEliminacion(): void {
    const categoria = this.categoriaAEliminar();
    if (!categoria) {
      return;
    }
    this.eliminando.set(true);
    this.exito.set('');
    this.errorEliminar.set('');

    this.categoriaService.eliminar(categoria.id).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.categoriaAEliminar.set(null);
        this.exito.set(`Categoría «${categoria.nombre}» eliminada correctamente.`);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.eliminando.set(false);
        this.categoriaAEliminar.set(null);
        this.errorEliminar.set(mensajeError(e));
        if (e.status === 404) {
          this.cargar();
        }
      },
    });
  }
}
