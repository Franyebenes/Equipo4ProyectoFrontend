import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { AuthService, ErrorAutenticacion } from '../core/auth.service';
import { Login } from './login';

describe('Login', () => {
  const auth = { login: vi.fn() };

  beforeEach(async () => {
    auth.login.mockReset();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();
  });

  function crear() {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    return {
      fixture,
      componente: fixture.componentInstance,
      html: fixture.nativeElement as HTMLElement,
    };
  }

  async function enviar(correo = 'ana@ejemplo.es', contrasena = 'Clave-segura-1') {
    const vista = crear();
    vista.componente.correo = correo;
    vista.componente.contrasena = contrasena;
    await vista.componente.enviar(new Event('submit'));
    vista.fixture.detectChanges();
    return vista;
  }

  it('no ofrece "recordar dispositivo": el backend no lo admite', () => {
    const { html } = crear();
    expect(html.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it('con credenciales correctas inicia sesión y vuelve a la portada', async () => {
    auth.login.mockResolvedValue({ id: '1', email: 'ana@ejemplo.es', nombre: 'Ana', rol: 'CLIENTE' });
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const { componente } = await enviar(' ana@ejemplo.es ');

    expect(auth.login).toHaveBeenCalledWith('ana@ejemplo.es', 'Clave-segura-1');
    expect(navegar).toHaveBeenCalledWith('/');
    expect(componente.contrasena).toBe('');
  });

  it('con credenciales incorrectas muestra un mensaje genérico y no navega', async () => {
    auth.login.mockRejectedValue(new ErrorAutenticacion('credenciales', 'Correo o contraseña incorrectos.'));
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    const { html } = await enviar();

    expect(html.querySelector('.error')?.textContent).toContain('Correo o contraseña incorrectos.');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('muestra los errores de validación junto al campo afectado', async () => {
    auth.login.mockRejectedValue(
      new ErrorAutenticacion('validacion', 'Revisa los datos introducidos.', {
        errores: { email: ['FORMATO_INVALIDO'] },
      }),
    );

    const { html } = await enviar('no-es-un-correo');

    expect(html.querySelector('.error-campo')?.textContent).toContain('El formato no es válido.');
  });

  it('ante un bloqueo temporal muestra la cuenta atrás y desactiva el botón', async () => {
    auth.login.mockRejectedValue(
      new ErrorAutenticacion('bloqueado', 'Demasiados intentos.', { reintentarEnSegundos: 30 }),
    );

    const { componente, html } = await enviar();

    expect(componente.segundosRestantes()).toBe(30);
    expect(html.querySelector('.error')?.textContent).toContain('Vuelve a intentarlo en 30 s');
    expect(html.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });

  it('ante un fallo del servidor muestra el código para el soporte', async () => {
    auth.login.mockRejectedValue(
      new ErrorAutenticacion('servidor', 'El servicio no está disponible.', { correlationId: 'abc-123' }),
    );

    const { html } = await enviar();

    expect(html.querySelector('.error')?.textContent).toContain('abc-123');
  });
});
