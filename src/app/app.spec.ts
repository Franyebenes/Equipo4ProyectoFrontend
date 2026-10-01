import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    // El h1 vive en la Home enrutada; hay que completar la navegación inicial.
    await TestBed.inject(Router).navigateByUrl('/');
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne('http://localhost:8080/api/public/home')
      .flush({
        nombre: 'ESIBuy',
        descripcion: 'Plataforma de comercio electrónico',
        version: '1.0.0',
        caracteristicas: [],
        contacto: { email: 'soporte@esibuy.com', telefono: '+34 900 000 000' },
      });
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Descubre mejor');
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });
});
