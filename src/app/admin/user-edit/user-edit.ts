import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Usuario, DatosModificacion } from '../admin.service';
import { CategoriaService, Categoria } from '../categoria.service';

@Component({
  selector: 'app-user-edit',
  imports: [FormsModule],
  templateUrl: './user-edit.html',
  styleUrls: ['../admin-shared.css', './user-edit.css'],
})
export class UserEdit {
  private categoriaService = inject(CategoriaService);

  @Output() guardar = new EventEmitter<{ id: string; datos: DatosModificacion }>();
  @Output() cancelar = new EventEmitter<void>();
  @Input() errorServidor = '';

  original: Usuario | null = null;
  form: DatosModificacion | null = null;
  error = '';
  categorias = signal<Categoria[]>([]);

  // Mismos identificadores que el catálogo del backend (esibuy.avatares.disponibles)
  readonly avatares = ['avatar-01', 'avatar-02', 'avatar-03', 'avatar-04'];

  @Input() set usuario(u: Usuario | null) {
    this.original = u;
    this.error = '';
    this.form = u
      ? {
          nombre: u.nombre ?? '', apellidos: u.apellidos ?? '', dni: u.dni ?? '',
          telefono: u.telefono ?? '', sede: u.sede ?? '',
          fechaNacimiento: u.fechaNacimiento ?? null,
          nombreComercial: u.nombreComercial ?? '',
          categoriaPrincipalId: u.categoriaPrincipalId ?? '',
          avatar: u.avatar ?? '',
        }
      : null;
    if (u && this.esVendedor && this.categorias().length === 0) {
      this.categoriaService.listar().subscribe((c) => this.categorias.set(c));
    }
  }

  get esAdmin(): boolean {
    return this.original?.roles.includes('ADMIN') ?? false;
  }

  get esVendedor(): boolean {
    return this.original?.roles.includes('VENDEDOR') ?? false;
  }

  get esCliente(): boolean {
    return (this.original?.roles.includes('CLIENTE') || this.original?.roles.includes('PREMIUM')) ?? false;
  }

  get carpetaAvatares(): string {
    return this.esVendedor ? 'vendedores' : 'clientes';
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
    if (this.esVendedor && !this.form.nombreComercial.trim()) {
      this.error = 'El nombre comercial es obligatorio.';
      return;
    }
    // Una fecha vacía se envía como null (el backend conserva la actual)
    this.guardar.emit({
      id: this.original.id,
      datos: { ...this.form, fechaNacimiento: this.form.fechaNacimiento || null },
    });
  }

  onCancelar(): void {
    this.cancelar.emit();
  }

  // Solo cierra si el clic cae en el fondo, no dentro del modal
  onClickFondo(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.onCancelar();
  }
}
