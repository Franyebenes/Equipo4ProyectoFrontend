<<<<<<< HEAD
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
=======
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HomeApiService } from './home-api.service';
import { HomeInfo } from './home-info';
>>>>>>> origin/feature/registro

// Página Home: el contenido se mueve aquí para poder enrutar login y registro.
@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
<<<<<<< HEAD
})
export class Home {}
=======
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly homeApi = inject(HomeApiService);

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
}
>>>>>>> origin/feature/registro
