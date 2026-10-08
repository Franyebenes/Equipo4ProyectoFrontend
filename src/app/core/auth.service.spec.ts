import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { apiInterceptor } from './api.interceptor';
import { AuthService, ErrorAutenticacion } from './auth.service';

const API = 'http://localhost:8080';
const USUARIO = { id: '665f1c2e', email: 'ana@ejemplo.es', nombre: 'Ana', rol: 'CLIENTE' as const };

// Deja que el servicio avance hasta su siguiente petición (usa promesas entre una y otra).
const esperar = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

describe('AuthService', () => {
  let servicio: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    servicio = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // Atiende la petición del token CSRF que precede a toda petición que modifica datos.
  async function servirToken(token: string): Promise<void> {
    await esperar();
    http.expectOne(`${API}/api/auth/csrf`).flush({ token, headerName: 'X-CSRF-TOKEN' });
    await esperar();
  }

  async function iniciarSesion(): Promise<void> {
    const promesa = servicio.login(USUARIO.email, 'Clave-segura-1');
    await servirToken('token-1');
    http.expectOne(`${API}/api/auth/login`).flush({ ...USUARIO, mensaje: 'Inicio de sesion correcto' });
    await promesa;
  }

  describe('login', () => {
    it('pide el token CSRF, envía solo email y contrasena con credenciales y guarda al usuario', async () => {
      const promesa = servicio.login(USUARIO.email, 'Clave-segura-1');
      await servirToken('token-1');

      const peticion = http.expectOne(`${API}/api/auth/login`);
      expect(peticion.request.method).toBe('POST');
      expect(peticion.request.headers.get('X-CSRF-TOKEN')).toBe('token-1');
      expect(peticion.request.withCredentials).toBe(true);
      expect(peticion.request.body).toEqual({ email: USUARIO.email, contrasena: 'Clave-segura-1' });
      peticion.flush({ ...USUARIO, mensaje: 'Inicio de sesion correcto' });

      expect(await promesa).toEqual(USUARIO);
      expect(servicio.usuario()).toEqual(USUARIO);
    });

    it('tras entrar descarta el token (la sesión se rota) y pide uno nuevo para la siguiente petición', async () => {
      await iniciarSesion();

      const promesa = servicio.logout();
      await servirToken('token-2');
      const logout = http.expectOne(`${API}/api/auth/logout`);
      expect(logout.request.headers.get('X-CSRF-TOKEN')).toBe('token-2');
      logout.flush(null, { status: 204, statusText: 'No Content' });
      await promesa;
    });

    it('si el servidor responde 403 pide un token nuevo y reintenta una sola vez', async () => {
      const promesa = servicio.login(USUARIO.email, 'Clave-segura-1');
      await servirToken('token-viejo');
      http.expectOne(`${API}/api/auth/login`).flush({}, { status: 403, statusText: 'Forbidden' });

      await servirToken('token-nuevo');
      const reintento = http.expectOne(`${API}/api/auth/login`);
      expect(reintento.request.headers.get('X-CSRF-TOKEN')).toBe('token-nuevo');
      reintento.flush({ ...USUARIO, mensaje: 'ok' });

      expect(await promesa).toEqual(USUARIO);
    });

    async function fallar(estado: number, cuerpo: object | null, cabeceras: Record<string, string> = {}) {
      const promesa = servicio.login(USUARIO.email, 'mala');
      const resultado = promesa.catch((error) => error);
      await servirToken('token-1');
      http.expectOne(`${API}/api/auth/login`).flush(cuerpo, { status: estado, statusText: 'Error', headers: cabeceras });
      const error = await resultado;
      expect(error).toBeInstanceOf(ErrorAutenticacion);
      expect(servicio.usuario()).toBeNull();
      return error as ErrorAutenticacion;
    }

    it('401: credenciales incorrectas, con un mensaje genérico', async () => {
      const error = await fallar(401, { mensaje: 'Credenciales invalidas' });
      expect(error.tipo).toBe('credenciales');
      expect(error.message).toBe('Correo o contraseña incorrectos.');
    });

    it('403 con el código de cuenta pendiente: mensaje de activación y sin reintento de CSRF', async () => {
      const error = await fallar(403, { mensaje: 'Cuenta pendiente de activacion', codigo: 'CUENTA_PENDIENTE_DE_ACTIVACION' });
      expect(error.tipo).toBe('pendiente');
      expect(error.message).toContain('pendiente de activación');
      // afterEach verifica que no se pidió otro token ni se reenvió el login
    });

    it('400: errores por campo del backend', async () => {
      const error = await fallar(400, { errores: { email: ['FORMATO_INVALIDO'] } });
      expect(error.tipo).toBe('validacion');
      expect(error.detalle.errores).toEqual({ email: ['FORMATO_INVALIDO'] });
    });

    it('429: bloqueo temporal con el tiempo de Retry-After', async () => {
      const error = await fallar(429, { mensaje: 'Demasiados intentos' }, { 'Retry-After': '30' });
      expect(error.tipo).toBe('bloqueado');
      expect(error.detalle.reintentarEnSegundos).toBe(30);
    });

    it('503: servicio no disponible, con el correlationId para el soporte', async () => {
      const error = await fallar(503, { mensaje: 'x', correlationId: 'abc-123' });
      expect(error.tipo).toBe('servidor');
      expect(error.detalle.correlationId).toBe('abc-123');
    });

    it('sin respuesta del servidor: error de red', async () => {
      const error = await fallar(0, new ProgressEvent('error'));
      expect(error.tipo).toBe('red');
    });
  });

  describe('restaurarSesion', () => {
    it('con la cookie viva recupera al usuario', async () => {
      const promesa = servicio.restaurarSesion();
      const peticion = http.expectOne(`${API}/api/auth/me`);
      expect(peticion.request.withCredentials).toBe(true);
      peticion.flush(USUARIO);
      await promesa;
      expect(servicio.usuario()).toEqual(USUARIO);
    });

    it('sin sesión (401) deja al usuario en null sin lanzar error', async () => {
      const promesa = servicio.restaurarSesion();
      http.expectOne(`${API}/api/auth/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
      await promesa;
      expect(servicio.usuario()).toBeNull();
    });
  });

  describe('logout', () => {
    it('invalida la sesión y limpia al usuario', async () => {
      await iniciarSesion();
      expect(servicio.usuario()).not.toBeNull();

      const promesa = servicio.logout();
      await servirToken('token-2');
      http.expectOne(`${API}/api/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
      await promesa;

      expect(servicio.usuario()).toBeNull();
    });

    it('si el servidor falla, limpia igualmente el estado local y avisa del error', async () => {
      await iniciarSesion();

      const resultado = servicio.logout().catch((error) => error);
      await servirToken('token-2');
      http.expectOne(`${API}/api/auth/logout`).flush({}, { status: 503, statusText: 'Unavailable' });

      expect(await resultado).toBeInstanceOf(ErrorAutenticacion);
      expect(servicio.usuario()).toBeNull();
    });
  });

  describe('interceptor', () => {
    it('un 401 en una ruta normal significa sesión caducada: limpia al usuario y va al login', async () => {
      await iniciarSesion();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      TestBed.inject(HttpClient)
        .get(`${API}/api/pedidos`)
        .subscribe({ error: () => undefined });
      http.expectOne(`${API}/api/pedidos`).flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(servicio.usuario()).toBeNull();
      expect(navegar).toHaveBeenCalledWith('/login');
    });

    it('un 401 del propio login no se trata como sesión caducada', async () => {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      const promesa = servicio.login(USUARIO.email, 'mala').catch((error) => error);
      await servirToken('token-1');
      http.expectOne(`${API}/api/auth/login`).flush({}, { status: 401, statusText: 'Unauthorized' });
      await promesa;

      expect(navegar).not.toHaveBeenCalled();
    });
  });
});
