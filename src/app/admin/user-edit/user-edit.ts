import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Usuario, DatosModificacion } from '../admin.service';

@Component({
  selector: 'app-user-edit',
  imports: [FormsModule],
  templateUrl: './user-edit.html',
  styleUrls: ['../admin-shared.css', './user-edit.css'],
})
export class UserEdit {
  @Output() guardar = new EventEmitter<{ id: string; datos: DatosModificacion }>();
  @Output() cancelar = new EventEmitter<void>();

  // Error del backend al guardar: se muestra dentro del modal, que tapa el aviso de la página
  @Input() errorServidor = '';

  original: Usuario | null = null;
  form: DatosModificacion | null = null;
  error = '';

  // Cada vez que se abre, copia los datos para no tocar la tabla hasta guardar
  @Input() set usuario(u: Usuario | null) {
    this.original = u;
    this.error = '';
    this.form = u
      ? { nombre: u.nombre ?? '', apellidos: u.apellidos ?? '', dni: u.dni ?? '', telefono: u.telefono ?? '', sede: u.sede ?? '' }
      : null;
  }

  get esAdmin(): boolean {
    return this.original?.roles.includes('ADMIN') ?? false;
  }

  onGuardar(): void {
    if (!this.original || !this.form) return;
    this.error = '';
    if (!this.form.nombre.trim() || !this.form.apellidos.trim()) {
      this.error = 'El nombre y los apellidos son obligatorios.';
      return;
    }
    if (this.form.telefono && !/^[0-9]{9}$/.test(this.form.telefono)) {
      this.error = 'El teléfono debe tener exactamente 9 números.';
      return;
    }
    this.guardar.emit({ id: this.original.id, datos: { ...this.form } });
  }

  onCancelar(): void {
    this.cancelar.emit();
  }
}