import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { mensajeError } from '../admin.service';
import { Categoria, CategoriaService, validarCategoria } from '../categoria.service';

@Component({
  selector: 'app-editar-categoria',
  imports: [FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './editar-categoria.html',
  // Mismo formulario que Crear categoría: se reutilizan sus estilos para que las dos pantallas se vean iguales
  styleUrls: ['../admin-shared.css', '../crear-categoria/crear-categoria.css', './editar-categoria.css'],
})
export class EditarCategoria implements OnInit {
  private categoriaService = inject(CategoriaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private id = '';
  datos: Omit<Categoria, 'id'> = { nombre: '', descripcion: '' };
  cargando = signal(true);
  errorCarga = signal('');
  guardando = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.categoriaService.obtener(this.id).subscribe({
      next: (categoria) => {
        this.datos = { nombre: categoria.nombre, descripcion: categoria.descripcion };
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.cargando.set(false);
        this.errorCarga.set(mensajeError(e));
      },
    });
  }

  guardar(): void {
    this.error.set('');

    const datos = { nombre: this.datos.nombre.trim(), descripcion: this.datos.descripcion.trim() };
    const fallo = validarCategoria(datos);
    if (fallo) {
      this.error.set(fallo);
      return;
    }

    this.guardando.set(true);
    this.categoriaService.modificar(this.id, datos).subscribe({
      next: (categoria) => {
        this.guardando.set(false);
        // El listado se vuelve a cargar al entrar, así que el cambio se ve al momento
        this.router.navigate(['/admin/categorias'], {
          state: { exito: `Categoría «${categoria.nombre}» modificada correctamente.` },
        });
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.error.set(mensajeError(e));
      },
    });
  }
}
