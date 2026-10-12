import { Injectable, signal } from '@angular/core';

// Ventanas informativas de la cabecera (Cómo funciona, Seguridad y Ayuda).
export type Ventana = 'como-funciona' | 'seguridad' | 'ayuda';

// Ventana informativa abierta. La pinta la cáscara de la app (app.html), así que cualquier página puede abrirla.
@Injectable({ providedIn: 'root' })
export class VentanaInfoService {
  readonly abierta = signal<Ventana | null>(null);
}
