import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface CategoriaDTO {
  nombre: string;
}

@Component({
  selector: 'app-crear-categoria',
  imports: [FormsModule],
  templateUrl: './crear-categoria.html',
  styleUrl: './crear-categoria.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrearCategoriaComponent {
  nombreCategoria: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isInvalid: boolean = false;

  constructor() {}

  // Limpia el error visual mientras el usuario escribe
  onInput(): void {
    if (this.nombreCategoria.trim().length > 0) {
      this.isInvalid = false;
      this.errorMessage = '';
    }
  }

  // Validación de negocio equivalente a CategoriaDTO en Spring
  validarNombre(): boolean {
    const nombreLimpio = this.nombreCategoria.trim();

    if (!nombreLimpio) {
      this.errorMessage = 'El nombre de la categoría es obligatorio.';
      this.isInvalid = true;
      return false;
    }

    if (nombreLimpio.length > 50) {
      this.errorMessage = 'El nombre no puede superar los 50 caracteres.';
      this.isInvalid = true;
      return false;
    }

    this.errorMessage = '';
    this.isInvalid = false;
    return true;
  }

  // Envió del formulario
  onSubmit(): CategoriaDTO | null {
    this.successMessage = '';

    if (!this.validarNombre()) {
      return null;
    }

    const payload: CategoriaDTO = {
      nombre: this.nombreCategoria.trim()
    };

    console.log('Payload DTO preparado:', payload);
    this.successMessage = `Categoría "${payload.nombre}" validada correctamente.`;

    return payload;
  }

  // Limpiar el formulario
  resetForm(): void {
    this.nombreCategoria = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.isInvalid = false;
  }
}