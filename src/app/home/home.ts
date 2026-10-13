import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { VentanaInfoService } from '../compartido/ventana-info/ventana-info.service';
import { HomeApiService } from './home-api.service';
import { HomeInfo } from './home-info';

// Página Home: el contenido se mueve aquí para poder enrutar login y registro.
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly homeApi = inject(HomeApiService);
  private readonly ventanas = inject(VentanaInfoService);

  readonly homeInfo = signal<HomeInfo | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  constructor() {
    this.loadHomeInfo();
  }

  loadHomeInfo(): void {
    this.loading.set(true);
    this.error.set(false);

    this.homeApi.getHomeInfo().subscribe({
      next: (info) => {
        this.homeInfo.set(info);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  // "Centro de ayuda" del pie: la misma ventana que el botón Ayuda de la cabecera.
  abrirAyuda(): void {
    this.ventanas.abierta.set('ayuda');
  }
}
