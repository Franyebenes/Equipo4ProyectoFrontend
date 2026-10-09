import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      // La cabecera usa AuthService, que necesita HttpClient (aquí sin red real).
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    // El h1 vive en la Home enrutada; hay que completar la navegación inicial. La portada pasa por sinAdminGuard,
    // que pregunta por la sesión: se responde 401 (visitante sin sesión) para que la navegación termine.
    const navegacion = TestBed.inject(Router).navigateByUrl('/');
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.inject(HttpTestingController)
      .expectOne((peticion) => peticion.url.endsWith('/api/auth/me'))
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    await navegacion;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Descubre mejor');
  });
});
