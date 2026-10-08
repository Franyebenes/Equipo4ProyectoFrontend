import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

describe('Home', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the public home details and renders them', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    const request = httpTesting.expectOne('http://localhost:8080/api/public/home');
    expect(request.request.method).toBe('GET');
    request.flush({
      nombre: 'ESIBuy',
      descripcion: 'Plataforma de comercio electrónico segura.',
      version: '1.0.0',
      caracteristicas: ['Búsqueda de productos', 'Gestión de pedidos'],
      contacto: { email: 'soporte@esibuy.com', telefono: '+34 900 000 000' },
    });
    fixture.detectChanges();

    const content = fixture.nativeElement as HTMLElement;
    expect(content.textContent).toContain('Plataforma de comercio electrónico segura.');
    expect(content.textContent).toContain('Búsqueda de productos');
    expect(content.querySelector('a[href="mailto:soporte@esibuy.com"]')).not.toBeNull();
    expect(content.querySelector('a[href="tel:+34 900 000 000"]')).not.toBeNull();
  });

  it('shows an error and allows retrying when the request fails', () => {
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:8080/api/public/home').error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'No se ha podido cargar la información de ESIBuy',
    );

    fixture.nativeElement.querySelector('.api-error button').click();
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:8080/api/public/home').flush({
      nombre: 'ESIBuy',
      descripcion: 'Descripción',
      version: '1.0.0',
      caracteristicas: [],
      contacto: { email: 'soporte@esibuy.com', telefono: '+34 900 000 000' },
    });
  });
});
