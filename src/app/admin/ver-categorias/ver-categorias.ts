import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { mensajeError } from '../admin.service';
import { Categoria, CategoriaService } from '../categoria.service';

@Component({
  selector: 'app-ver-categorias',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './ver-categorias.html',
    styleUrls: ['../admin-shared.css', './ver-categorias.css'],
})
export class VerCategorias implements OnInit {
  private categoriaService = inject(CategoriaService);

  categorias = signal<Categoria[]>([]);
  cargando = signal(false);
  error = signal('');
  categoriaAEliminar = signal<Categoria | null>(null);

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
}
