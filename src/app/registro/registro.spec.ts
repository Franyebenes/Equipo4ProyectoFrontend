import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Registro } from './registro';

const URL_REGISTRO = 'http://localhost:8080/api/auth/registro';
const URL_QR = 'http://localhost:8080/api/auth/registro/2fa';
const CODIGO = '123456';
const ACTIVACION = {
  uri: 'otpauth://totp/ESIBuy:ana.garcia%40gmail.com?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=ESIBuy',
  secreto: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
};
const CODIGOS_RECUPERACION = ['ABCD-EFGH-IJKL-MNOP', 'QRST-UVWX-YZ23-4567'];
const URL_CATEGORIAS = 'http://localhost:8080/api/registro/categorias';
// Valor de prueba: cumple la política (12 a 128 caracteres) y no se usa en ningún sitio real.
const CONTRASENA = 'Una-contrasena-de-prueba-1';
const CATEGORIAS = [
  { id: '64b7f0c2a1b2c3d4e5f60718', nombre: 'Electrónica' },
  { id: '64b7f0c2a1b2c3d4e5f60719', nombre: 'Hogar' },
];
const RESPUESTA_CREADA = {
  id: '6abf8139248106940a49d988',
  email: 'ana.garcia@gmail.com',
  nombre: 'Ana',
  mensaje: 'Tu cuenta se ha creado correctamente.',
  codigosRecuperacion: CODIGOS_RECUPERACION,
};

describe('Registro', () => {
  let fixture: ComponentFixture<Registro>;
  let pagina: HTMLElement;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Registro);
    pagina = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Falla si quedó alguna petición sin atender o si se hizo alguna que el test no esperaba.
    httpTesting.verify();
  });

  // ---------------------------------------------------------------- utilidades

  const buscar = <T extends HTMLElement = HTMLInputElement>(selector: string): T | null =>
    pagina.querySelector<T>(selector);

  const campo = <T extends HTMLElement = HTMLInputElement>(selector: string): T => {
    const elemento = buscar<T>(selector);
    if (!elemento) {
      throw new Error(`No existe ${selector} en la página`);
    }
    return elemento;
  };

  const texto = (selector: string): string => buscar(selector)?.textContent?.trim() ?? '';

  function escribir(selector: string, valor: string): void {
    const elemento = campo<HTMLInputElement | HTMLSelectElement>(selector);
    elemento.value = valor;
    elemento.dispatchEvent(new Event(elemento instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  const elegirRol = (posicion: 0 | 1): void => {
    pagina.querySelectorAll<HTMLButtonElement>('.rol')[posicion].click();
    fixture.detectChanges();
  };

  function elegirVendedor(): void {
    elegirRol(1);
    httpTesting.expectOne(URL_CATEGORIAS).flush(CATEGORIAS);
    fixture.detectChanges();
  }

  function rellenarComunes(): void {
    escribir('#nombre', 'Ana');
    escribir('#apellidos', 'García López');
    escribir('#email', 'ana.garcia@gmail.com');
    escribir('#dni', '12345678Z');
    escribir('#contrasena', CONTRASENA);
    escribir('#repetirContrasena', CONTRASENA);
    campo('#condiciones').click();
  }

  function rellenarCliente(): void {
    rellenarComunes();
    escribir('#fechaNacimiento', '2000-05-15');
    fixture.detectChanges();
  }

  // Equivale a pulsar el botón o la tecla Intro dentro del formulario.
  function enviar(): void {
    campo<HTMLFormElement>('form').dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
  }

  // Primer paso: los datos piden el QR del 2FA y se pasa a la verificación.
  function pedirQr(): void {
    enviar();
    httpTesting.expectOne({ method: 'POST', url: URL_QR }).flush(ACTIVACION);
    fixture.detectChanges();
  }

  // Segundo paso: se escribe el código y se envía el registro.
  function enviarYCapturar(codigo = CODIGO): TestRequest {
    pedirQr();
    escribir('#codigoDosFactores', codigo);
    enviar();
    return httpTesting.expectOne({ method: 'POST', url: URL_REGISTRO });
  }

  // Tercer paso: se guardan los códigos de recuperación y se pasa a la confirmación.
  function terminarConLosCodigos(): void {
    campo('.codigos-registro input[type="checkbox"]').click();
    fixture.detectChanges();
    campo('.codigos-registro button.btn-coral').click();
    fixture.detectChanges();
  }

  function responderError(
    peticion: TestRequest,
    status: number,
    cuerpo: object | null,
    cabeceras: Record<string, string> = {},
  ): void {
    peticion.flush(cuerpo, { status, statusText: 'Error', headers: cabeceras });
    fixture.detectChanges();
  }

  // ---------------------------------------------------------------- tipo de cuenta

  describe('tipo de cuenta', () => {
    it('muestra por defecto los campos de cliente y no los de vendedor', () => {
      expect(buscar('#fechaNacimiento')).not.toBeNull();
      expect(buscar('#nombreComercial')).toBeNull();
      expect(buscar('#categoriaPrincipalId')).toBeNull();
    });

    it('al elegir vendedor pide nombre comercial y categoría, y oculta la fecha de nacimiento', () => {
      elegirVendedor();

      expect(buscar('#nombreComercial')).not.toBeNull();
      expect(buscar('#fechaNacimiento')).toBeNull();
      const opciones = [...pagina.querySelectorAll('#categoriaPrincipalId option')].map((o) =>
        o.textContent?.trim(),
      );
      expect(opciones).toEqual(['Elige una categoría', 'Electrónica', 'Hogar']);
    });

    it('carga las categorías una sola vez aunque se cambie varias veces de rol', () => {
      elegirVendedor();
      elegirRol(0);
      elegirRol(1);

      expect(buscar('#categoriaPrincipalId')).not.toBeNull();
      // httpTesting.verify() en afterEach falla si se hubiera pedido una segunda vez.
    });

    it('si fallan las categorías ofrece reintentar', () => {
      elegirRol(1);
      httpTesting.expectOne(URL_CATEGORIAS).flush(null, { status: 500, statusText: 'Error' });
      fixture.detectChanges();
      expect(pagina.textContent).toContain('No se han podido cargar las categorías');

      campo<HTMLButtonElement>('.error-campo button').click();
      httpTesting.expectOne(URL_CATEGORIAS).flush(CATEGORIAS);
      fixture.detectChanges();

      expect(pagina.querySelectorAll('#categoriaPrincipalId option').length).toBe(3);
      expect(pagina.textContent).not.toContain('No se han podido cargar las categorías');
    });
  });

  // ---------------------------------------------------------------- validación local

  describe('validación antes de enviar', () => {
    it('con el formulario vacío no envía nada, muestra los errores y enfoca el primer campo', () => {
      enviar();

      expect(texto('#error-nombre')).toBe('Este campo es obligatorio.');
      expect(texto('#error-email')).toBe('Este campo es obligatorio.');
      expect(texto('#error-condiciones')).toContain('Debes aceptar las condiciones');
      expect(document.activeElement).toBe(campo('#nombre'));
    });

    it('avisa si las contraseñas no coinciden, también si solo cambian las mayúsculas', () => {
      rellenarCliente();
      escribir('#repetirContrasena', CONTRASENA.replace('prueba', 'PRUEBA'));
      enviar();

      expect(texto('#error-repetirContrasena')).toBe('Las contraseñas no coinciden.');
    });

    it('avisa de una contraseña de menos de 12 caracteres', () => {
      rellenarCliente();
      escribir('#contrasena', 'Corta-1a');
      escribir('#repetirContrasena', 'Corta-1a');
      enviar();

      expect(texto('#error-contrasena')).toBe('La contraseña debe tener al menos 12 caracteres.');
    });

    it('avisa a la vez de todo lo que le falta a la contraseña', () => {
      rellenarCliente();
      escribir('#contrasena', 'abcdefghijkl');
      escribir('#repetirContrasena', 'abcdefghijkl');
      enviar();

      const mensajes = Array.from(pagina.querySelectorAll('#error-contrasena .error-campo')).map((p) =>
        p.textContent?.trim(),
      );
      expect(mensajes).toEqual([
        'La contraseña debe incluir al menos un número.',
        'La contraseña debe incluir al menos un carácter especial, como - _ . ! @ #.',
        'La contraseña debe incluir al menos una letra mayúscula.',
      ]);
    });

    it('avisa a un menor de edad antes de enviar', () => {
      rellenarCliente();
      const hace17 = new Date().getFullYear() - 17;
      escribir('#fechaNacimiento', `${hace17}-06-15`);
      enviar();

      expect(texto('#error-fechaNacimiento')).toBe('Debes ser mayor de 18 años para registrarte.');
    });

    it('avisa de un teléfono que no tiene 9 dígitos', () => {
      rellenarCliente();
      escribir('#telefono', '612 345 678');
      enviar();

      expect(texto('#error-telefono')).toContain('9 dígitos');
    });

    it('avisa de un nombre con caracteres que el backend rechaza', () => {
      rellenarCliente();
      escribir('#nombre', '<script>');
      enviar();

      expect(texto('#error-nombre')).toBe('No uses los caracteres < > { } $.');
    });
  });

  // ---------------------------------------------------------------- envío

  describe('verificación en dos pasos', () => {
    it('al continuar pide el QR con solo el correo, sin crear la cuenta todavía', () => {
      rellenarCliente();
      enviar();

      const peticion = httpTesting.expectOne({ method: 'POST', url: URL_QR });
      expect(peticion.request.body).toEqual({ email: 'ana.garcia@gmail.com' });
      peticion.flush(ACTIVACION);
      fixture.detectChanges();

      expect(buscar('app-qr-dos-factores')).not.toBeNull();
      expect(texto('app-qr-dos-factores .secreto')).toBe('GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ');
      expect(buscar('#codigoDosFactores')).not.toBeNull();
      expect(buscar('#nombre')).toBeNull();
    });

    it('lleva el foco al campo del código', () => {
      rellenarCliente();
      pedirQr();

      expect(document.activeElement).toBe(campo('#codigoDosFactores'));
    });

    it('exige el código y no envía el registro sin él', () => {
      rellenarCliente();
      pedirQr();

      enviar(); // httpTesting.verify() fallaría si se enviara algo

      expect(texto('#error-codigoDosFactores')).toBe('Este campo es obligatorio.');
    });

    it('con un código incorrecto se queda en este paso y lo explica', () => {
      rellenarCliente();
      responderError(enviarYCapturar('000000'), 400, { errores: { codigoDosFactores: ['CODIGO_INCORRECTO'] } });

      expect(texto('#error-codigoDosFactores')).toContain('El código no es correcto');
      expect(buscar('#codigoDosFactores')).not.toBeNull();
      expect(buscar('#nombre')).toBeNull();
    });

    it('si el QR ya no vale vuelve a los datos y avisa de que hay que pedir otro', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, { errores: { codigoDosFactores: ['ACTIVACION_NO_VIGENTE'] } });

      expect(texto('.error-general')).toContain('El código QR ha caducado');
      expect(campo<HTMLInputElement>('#email').value).toBe('ana.garcia@gmail.com');
      expect(buscar('app-qr-dos-factores')).toBeNull();
    });

    it('si fallan los datos vuelve a ellos y pinta el error junto a su campo', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, { errores: { email: ['DOMINIO_EMAIL_INEXISTENTE'] } });

      expect(buscar('#nombre')).not.toBeNull();
      expect(texto('#error-email')).toContain('no puede recibir emails');
    });

    it('permite volver a los datos y pide un QR nuevo al continuar', () => {
      rellenarCliente();
      pedirQr();

      campo<HTMLButtonElement>('button.btn-ghost').click();
      fixture.detectChanges();
      expect(campo<HTMLInputElement>('#email').value).toBe('ana.garcia@gmail.com');

      pedirQr();
      expect(buscar('#codigoDosFactores')).not.toBeNull();
    });

    it('muestra los códigos de recuperación y no deja continuar hasta confirmar que se han guardado', () => {
      rellenarCliente();
      enviarYCapturar().flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      expect(texto('.codigos-registro')).toContain('ABCD-EFGH-IJKL-MNOP');
      expect(texto('.codigos-registro')).toContain('QRST-UVWX-YZ23-4567');
      expect(buscar('.confirmacion')).toBeNull();
      expect(campo<HTMLButtonElement>('.codigos-registro button.btn-coral').disabled).toBe(true);

      campo('.codigos-registro input[type="checkbox"]').click();
      fixture.detectChanges();
      expect(campo<HTMLButtonElement>('.codigos-registro button.btn-coral').disabled).toBe(false);
      campo('.codigos-registro button.btn-coral').click();
      fixture.detectChanges();

      expect(buscar('.confirmacion')).not.toBeNull();
      expect(buscar('.codigos-registro')).toBeNull();
      expect(fixture.componentInstance.codigosRecuperacion()).toEqual([]);
    });

    it('un error al pedir el QR se muestra en el paso de los datos', () => {
      rellenarCliente();
      enviar();
      responderError(httpTesting.expectOne({ method: 'POST', url: URL_QR }), 400, {
        errores: { email: ['FORMATO_INVALIDO'] },
      });

      expect(texto('#error-email')).toContain('correo válido');
    });
  });

  describe('envío', () => {
    it('envía al cliente con solo sus campos y muestra la confirmación', () => {
      rellenarCliente();
      campo('#novedades').click();

      const peticion = enviarYCapturar();

      // Ni «condiciones» ni «novedades» viajan: el backend rechaza cualquier campo que no conozca.
      expect(peticion.request.body).toEqual({
        tipoCuenta: 'CLIENTE',
        nombre: 'Ana',
        apellidos: 'García López',
        dni: '12345678Z',
        email: 'ana.garcia@gmail.com',
        telefono: null,
        contrasena: CONTRASENA,
        repetirContrasena: CONTRASENA,
        codigoDosFactores: CODIGO,
        fechaNacimiento: '2000-05-15',
      });
      peticion.flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      terminarConLosCodigos();

      expect(buscar('.confirmacion')).not.toBeNull();
      expect(texto('.confirmacion')).toContain('ana.garcia@gmail.com');
      expect(texto('.confirmacion')).toContain('administrador');
      expect(buscar('form')).toBeNull();
      expect(buscar('.confirmacion a[href="/"]')).not.toBeNull();
    });

    it('lleva el foco al título de la confirmación para que se vea aunque el formulario fuera largo', () => {
      rellenarCliente();
      enviarYCapturar().flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      terminarConLosCodigos();

      expect(document.activeElement).toBe(campo('.confirmacion h2'));
    });

    it('borra el formulario, contraseñas incluidas, tras registrar', () => {
      rellenarCliente();
      const peticion = enviarYCapturar();
      peticion.flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });

      const valores = fixture.componentInstance.form.getRawValue();
      expect(valores.contrasena).toBe('');
      expect(valores.repetirContrasena).toBe('');
      expect(valores.email).toBe('');
    });

    it('envía el teléfono cuando se rellena y recorta los espacios de los textos', () => {
      rellenarCliente();
      escribir('#nombre', '  Ana  ');
      escribir('#telefono', '612345678');

      const { body } = enviarYCapturar().request;

      expect(body.telefono).toBe('612345678');
      expect(body.nombre).toBe('Ana');
    });

    it('envía al vendedor con nombre comercial y categoría, sin fecha de nacimiento', () => {
      // La fecha se rellena antes de cambiar de rol: no debe viajar en una solicitud de vendedor.
      escribir('#fechaNacimiento', '2000-05-15');
      elegirVendedor();
      rellenarComunes();
      escribir('#nombreComercial', '  Tienda Norte ');
      escribir('#categoriaPrincipalId', CATEGORIAS[0].id);
      fixture.detectChanges();

      const peticion = enviarYCapturar();

      expect(peticion.request.body).toEqual({
        tipoCuenta: 'VENDEDOR',
        nombre: 'Ana',
        apellidos: 'García López',
        dni: '12345678Z',
        email: 'ana.garcia@gmail.com',
        telefono: null,
        contrasena: CONTRASENA,
        repetirContrasena: CONTRASENA,
        codigoDosFactores: CODIGO,
        nombreComercial: 'Tienda Norte',
        categoriaPrincipalId: CATEGORIAS[0].id,
      });
      peticion.flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });
    });

    it('exige elegir categoría al vendedor', () => {
      elegirVendedor();
      rellenarComunes();
      escribir('#nombreComercial', 'Tienda Norte');
      enviar();

      expect(texto('#error-categoriaPrincipalId')).toBe('Este campo es obligatorio.');
    });

    it('deshabilita el botón mientras espera la respuesta y no envía dos veces', () => {
      rellenarCliente();
      const peticion = enviarYCapturar();

      const boton = campo<HTMLButtonElement>('button[type="submit"]');
      expect(boton.disabled).toBe(true);
      expect(boton.textContent).toContain('Creando cuenta');

      enviar(); // segundo intento mientras espera: se ignora (verify() fallaría con dos peticiones)
      peticion.flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });
    });
  });

  // ---------------------------------------------------------------- respuestas de error

  describe('errores del backend', () => {
    it('pinta cada error junto a su campo, con todos los de un mismo campo, y enfoca el primero', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, {
        errores: {
          email: ['DOMINIO_EMAIL_INEXISTENTE'],
          contrasena: ['CONTRASENA_COMUN', 'CONTRASENA_CON_DATOS_PERSONALES'],
        },
      });

      expect(texto('#error-email')).toContain('no puede recibir emails');
      expect(pagina.querySelectorAll('#error-contrasena .error-campo').length).toBe(2);
      expect(texto('.error-general')).toBe('Revisa los campos marcados en rojo.');
      expect(campo('#email').getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(campo('#email'));
    });

    it('quita el error de un campo cuando el usuario lo edita', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, {
        errores: { email: ['DOMINIO_EMAIL_INEXISTENTE'], dni: ['FORMATO_INVALIDO'] },
      });

      escribir('#email', 'otra@gmail.com');
      fixture.detectChanges();

      expect(buscar('#error-email')).toBeNull();
      expect(buscar('#error-dni')).not.toBeNull();
    });

    it('un error viejo del servidor no impide reenviar: se vuelve a comprobar todo', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, {
        errores: { contrasena: ['CONTRASENA_CON_DATOS_PERSONALES'] },
      });

      // El usuario corrige otro campo (el nombre) y no toca la contraseña.
      escribir('#nombre', 'Luisa');
      const reenvio = enviarYCapturar();

      expect(reenvio.request.body.nombre).toBe('Luisa');
      reenvio.flush(RESPUESTA_CREADA, { status: 201, statusText: 'Created' });
    });

    it('pinta junto al avatar un código que el servidor rechaza', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, { errores: { avatar: ['AVATAR_NO_PERMITIDO'] } });

      expect(texto('#error-avatar')).toBe('Elige uno de los avatares disponibles.');
    });

    it('trata un 400 sin lista de errores como una petición inválida', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 400, { mensaje: 'La peticion no es valida' });

      expect(texto('.error-general')).toContain('Los datos enviados no son válidos');
    });

    it('ante un 409 muestra un mensaje genérico, sin decir que el correo ya existe', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 409, {
        mensaje: 'No se ha podido completar el registro con los datos proporcionados',
      });

      const aviso = texto('.error-general');
      expect(aviso).toContain('No se ha podido completar el registro');
      expect(aviso.toLowerCase()).not.toContain('ya existe');
      expect(aviso.toLowerCase()).not.toContain('ya está registrado');
      // El formulario sigue ahí con sus datos para poder corregirlos.
      expect(campo<HTMLInputElement>('#email').value).toBe('ana.garcia@gmail.com');
    });

    it('ante un 429 bloquea el botón la cuenta atrás indicada en Retry-After', () => {
      vi.useFakeTimers();
      rellenarCliente();
      responderError(enviarYCapturar(), 429, {}, { 'Retry-After': '3' });

      const boton = campo<HTMLButtonElement>('button[type="submit"]');
      expect(texto('.error-general')).toContain('Demasiados intentos');
      expect(boton.disabled).toBe(true);
      expect(boton.textContent).toContain('Espera 3 s');

      enviar(); // durante la espera no se envía nada (verify() fallaría)

      vi.advanceTimersByTime(1000);
      fixture.detectChanges();
      expect(boton.textContent).toContain('Espera 2 s');

      vi.advanceTimersByTime(2000);
      fixture.detectChanges();
      expect(boton.disabled).toBe(false);
      expect(boton.textContent).toContain('Crear cuenta');
      expect(buscar('.error-general')).toBeNull();
    });

    it('espera 60 segundos si el 429 no trae Retry-After', () => {
      vi.useFakeTimers();
      rellenarCliente();
      responderError(enviarYCapturar(), 429, {});

      expect(campo('button[type="submit"]').textContent).toContain('Espera 60 s');
    });

    it('ante un 503 avisa de que no se puede comprobar el correo y da el código de referencia', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 503, {
        mensaje: 'El servicio no esta disponible',
        correlationId: 'abc-123',
      });

      expect(texto('.error-general')).toContain('No podemos comprobar tu correo');
      expect(texto('.error-general .referencia')).toContain('abc-123');
    });

    it('ante un 500 muestra un error genérico y toma la referencia de la cabecera', () => {
      rellenarCliente();
      responderError(enviarYCapturar(), 500, null, { 'X-Correlation-Id': 'cabecera-456' });

      expect(texto('.error-general')).toContain('error inesperado');
      expect(texto('.error-general .referencia')).toContain('cabecera-456');
    });

    it('si no hay conexión con el servidor lo explica', () => {
      rellenarCliente();
      enviarYCapturar().error(new ProgressEvent('error'));
      fixture.detectChanges();

      expect(texto('.error-general')).toContain('No se puede conectar con el servidor');
      expect(campo<HTMLButtonElement>('button[type="submit"]').disabled).toBe(false);
    });
  });
});
