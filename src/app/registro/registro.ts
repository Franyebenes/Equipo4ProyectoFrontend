import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CodigosRecuperacion } from '../seguridad/codigos-recuperacion';
import { QrDosFactores } from '../seguridad/qr-dos-factores';
import { ActivacionRegistro, Categoria, RespuestaRegistro, SolicitudRegistro } from './registro-api';
import { RegistroApiService } from './registro-api.service';
import { mensajeDe } from './registro-mensajes';
import {
  condicionesAceptadas,
  contrasenasCoinciden,
  contrasenaValida,
  emailValido,
  fechaNacimientoValida,
  telefonoOpcional,
  textoObligatorio,
} from './registro-validadores';

// Pasos del registro: los datos; el QR del 2FA con su primer código; y los códigos de recuperación (se ven una sola vez).
type FaseRegistro = 'datos' | 'verificacion' | 'codigos';

// Tipos de rol que se ven en el mockup de registro.
type RolRegistro = 'cliente' | 'vendedor';

type CampoRegistro =
  | 'nombre'
  | 'apellidos'
  | 'dni'
  | 'email'
  | 'telefono'
  | 'fechaNacimiento'
  | 'nombreComercial'
  | 'categoriaPrincipalId'
  | 'contrasena'
  | 'repetirContrasena'
  | 'condiciones'
  | 'avatar';

interface ErrorGeneral {
  texto: string;
  // Código del backend para localizar el error en sus logs (solo en 500 y 503).
  referencia?: string;
}

const SEGUNDOS_ESPERA_POR_DEFECTO = 60;

// Mismos identificadores que el backend. Hay 4 fotos de cliente y 4 de vendedor.
const AVATARES = ['avatar-01', 'avatar-02', 'avatar-03', 'avatar-04'] as const;

const TEXTOS_ERROR = {
  generico: 'No se ha podido completar el registro. Inténtalo de nuevo.',
  sinConexion: 'No se puede conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
  peticionInvalida: 'Los datos enviados no son válidos. Revisa el formulario.',
  revisaCampos: 'Revisa los campos marcados en rojo.',
  demasiadosIntentos:
    'Demasiados intentos de registro. Espera un momento antes de volver a intentarlo.',
  servicioNoDisponible:
    'No podemos comprobar tu correo ahora mismo. Inténtalo de nuevo en unos minutos.',
  errorInesperado: 'Se ha producido un error inesperado. Inténtalo de nuevo más tarde.',
  activacionNoVigente:
    'El código QR ha caducado o se han agotado los intentos. Pulsa «Continuar» para obtener uno nuevo.',
  // El backend responde igual esté o no registrado el email, para no revelar qué cuentas existen.
  noCompletado: 'No se ha podido completar el registro con los datos proporcionados.',
} as const;

// Página de registro de clientes y vendedores, en tres pasos. El 2FA (TOTP) es obligatorio y se configura aquí:
//  1. Datos. Al continuar se pide el QR (POST /api/auth/registro/2fa); aún no se crea ninguna cuenta.
//  2. Verificación. Se escanea el QR y se escribe el primer código; con él se envía el registro (POST /api/auth/registro).
//  3. Códigos de recuperación, que se muestran una sola vez hasta confirmar que se han guardado.
@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, NgTemplateOutlet, RouterLink, QrDosFactores, CodigosRecuperacion],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro {
  private readonly api = inject(RegistroApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  // Cliente aparece marcado por defecto, como en el mockup.
  readonly rol = signal<RolRegistro>('cliente');
  readonly enviando = signal(false);
  // Tras un intento de envío se muestran todos los errores, aunque el campo no se haya tocado.
  readonly intentado = signal(false);
  readonly errorGeneral = signal<ErrorGeneral | null>(null);
  readonly confirmacion = signal<RespuestaRegistro | null>(null);
  readonly esperaSegundos = signal(0);
  readonly fase = signal<FaseRegistro>('datos');
  readonly activacion = signal<ActivacionRegistro | null>(null);
  readonly errorCodigo = signal<string | null>(null);
  readonly codigosRecuperacion = signal<string[]>([]);
  readonly codigosGuardados = signal(false);
  // Primer código del 2FA (segundo paso). No va en el formulario de datos.
  readonly codigo = this.fb.control('');
  readonly categorias = signal<Categoria[]>([]);
  readonly estadoCategorias = signal<'inicial' | 'cargando' | 'listo' | 'error'>('inicial');
  readonly avatares = AVATARES;
  // Botones del ojo: muestran u ocultan cada contraseña por separado.
  readonly verContrasena = signal(false);
  readonly verRepetirContrasena = signal(false);

  // Los campos de vendedor empiezan deshabilitados: un control deshabilitado no cuenta para la validez.
  readonly form = this.fb.group(
    {
      nombre: ['', [textoObligatorio()]],
      apellidos: ['', [textoObligatorio()]],
      dni: ['', [textoObligatorio()]],
      email: ['', [emailValido()]],
      telefono: ['', [telefonoOpcional()]],
      fechaNacimiento: ['', [fechaNacimientoValida()]],
      // Solo para clientes: Premium se envía como tipoCuenta PREMIUM en lugar de CLIENTE. Estándar por defecto.
      premium: [false],
      nombreComercial: [{ value: '', disabled: true }, [textoObligatorio()]],
      categoriaPrincipalId: [{ value: '', disabled: true }, [textoObligatorio()]],
      avatar: [''],
      contrasena: ['', [contrasenaValida()]],
      repetirContrasena: ['', [contrasenaValida()]],
      // Estas dos casillas no viajan al backend: el servidor rechaza cualquier campo que no conozca.
      condiciones: [false, [condicionesAceptadas]],
      novedades: [false],
    },
    { validators: [contrasenasCoinciden] },
  );

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private cuentaCreada: RespuestaRegistro | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.detenerEspera();
      // Nada del secreto ni de los códigos queda en memoria al salir de la página
      this.activacion.set(null);
      this.codigosRecuperacion.set([]);
      this.cuentaCreada = null;
    });
  }

  elegirAvatar(id: string): void {
    this.form.controls.avatar.setValue(id);
    this.errorGeneral.set(null);
  }

  // Cliente y vendedor tienen fotos distintas; el id que viaja al back es el mismo (avatar-01 …).
  carpetaAvatares(): 'clientes' | 'vendedores' {
    return this.rol() === 'vendedor' ? 'vendedores' : 'clientes';
  }

  elegirRol(rol: RolRegistro): void {
    this.rol.set(rol);
    this.errorGeneral.set(null);
    this.form.controls.avatar.setValue('');
    const { fechaNacimiento, nombreComercial, categoriaPrincipalId } = this.form.controls;
    if (rol === 'vendedor') {
      fechaNacimiento.disable();
      nombreComercial.enable();
      categoriaPrincipalId.enable();
      if (this.estadoCategorias() === 'inicial') {
        this.cargarCategorias();
      }
    } else {
      fechaNacimiento.enable();
      nombreComercial.disable();
      categoriaPrincipalId.disable();
    }
  }

  cargarCategorias(): void {
    this.estadoCategorias.set('cargando');
    this.api.categorias().subscribe({
      next: (categorias) => {
        this.categorias.set(categorias);
        this.estadoCategorias.set('listo');
      },
      error: () => this.estadoCategorias.set('error'),
    });
  }

  // Mensajes de los errores del campo. Vacío mientras no haya que mostrarlos (campo sin tocar).
  // El backend puede devolver varios a la vez para un mismo campo, p. ej. una contraseña común
  // que además contiene el nombre del usuario.
  mensajesError(campo: CampoRegistro): string[] {
    const control = this.form.controls[campo];
    if (!(control.touched || this.intentado())) {
      return [];
    }
    const codigos = Object.keys(control.errors ?? {});
    if (campo === 'repetirContrasena' && this.form.hasError('CONTRASENAS_NO_COINCIDEN')) {
      codigos.push('CONTRASENAS_NO_COINCIDEN');
    }
    return [...new Set(codigos.map((codigo) => mensajeDe(campo, codigo)))];
  }

  ariaInvalid(campo: CampoRegistro): 'true' | null {
    return this.mensajesError(campo).length > 0 ? 'true' : null;
  }

  // Id del bloque de errores del campo, para enlazarlo con aria-describedby.
  ariaDescribedby(campo: CampoRegistro): string | null {
    return this.mensajesError(campo).length > 0 ? `error-${campo}` : null;
  }

  enviar(): void {
    if (this.enviando() || this.esperaSegundos() > 0) {
      return;
    }
    this.intentado.set(true);
    this.errorGeneral.set(null);
    this.descartarErroresDelServidor();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.enfocarPrimerError();
      return;
    }
    // Primer paso: el QR del 2FA. La cuenta se crea en el segundo, con el código.
    this.enviando.set(true);
    this.api.prepararDosFactores(this.form.controls.email.value.trim()).subscribe({
      next: (activacion) => this.alPrepararse(activacion),
      error: (error: unknown) => this.alFallar(error),
    });
  }

  // Segundo paso: con el primer código de la aplicación autenticadora se crea la cuenta.
  verificar(evento: Event): void {
    evento.preventDefault();
    if (this.enviando() || this.esperaSegundos() > 0) {
      return;
    }
    this.errorGeneral.set(null);
    this.errorCodigo.set(null);
    const codigo = this.codigo.value.trim();
    if (codigo === '') {
      this.errorCodigo.set(mensajeDe('codigoDosFactores', 'OBLIGATORIO'));
      this.enfocarCodigo();
      return;
    }
    this.enviando.set(true);
    this.api.registrar(this.construirSolicitud(codigo)).subscribe({
      next: (respuesta) => this.alRegistrar(respuesta),
      error: (error: unknown) => this.alFallar(error),
    });
  }

  // Vuelve a los datos para corregirlos; al continuar se pide un QR nuevo.
  volverALosDatos(): void {
    this.errorGeneral.set(null);
    this.errorCodigo.set(null);
    this.activacion.set(null);
    this.fase.set('datos');
  }

  // Los códigos de recuperación ya están guardados: se pasa a la confirmación y se olvidan.
  continuar(): void {
    this.confirmacion.set(this.cuentaCreada);
    this.cuentaCreada = null;
    this.codigosRecuperacion.set([]);
    this.codigosGuardados.set(false);
    this.cdr.detectChanges();
    this.host.nativeElement.querySelector<HTMLElement>('.confirmacion h2')?.focus();
  }

  private alPrepararse(activacion: ActivacionRegistro): void {
    this.enviando.set(false);
    this.activacion.set(activacion);
    this.codigo.reset('');
    this.errorCodigo.set(null);
    this.fase.set('verificacion');
    this.enfocarCodigo();
  }

  private enfocarCodigo(): void {
    this.cdr.detectChanges();
    this.host.nativeElement.querySelector<HTMLElement>('#codigoDosFactores')?.focus();
  }

  // Solo viajan los campos de su tipo de cuenta: el backend rechaza los que no le corresponden.
  private construirSolicitud(codigoDosFactores: string): SolicitudRegistro {
    const valores = this.form.getRawValue();
    const telefono = valores.telefono.trim();
    const avatar = valores.avatar.trim();
    const comunes = {
      nombre: valores.nombre.trim(),
      apellidos: valores.apellidos.trim(),
      dni: valores.dni.trim(),
      email: valores.email.trim(),
      telefono: telefono === '' ? null : telefono,
      // Sin foto elegida no se envía: el backend pone el avatar por defecto.
      ...(avatar ? { avatar } : {}),
      // La contraseña no se recorta: los espacios forman parte de ella.
      contrasena: valores.contrasena,
      repetirContrasena: valores.repetirContrasena,
      codigoDosFactores,
    };
    if (this.rol() === 'vendedor') {
      return {
        tipoCuenta: 'VENDEDOR',
        ...comunes,
        nombreComercial: valores.nombreComercial.trim(),
        categoriaPrincipalId: valores.categoriaPrincipalId,
      };
    }
    return {
      tipoCuenta: valores.premium ? 'PREMIUM' : 'CLIENTE',
      ...comunes,
      fechaNacimiento: valores.fechaNacimiento,
    };
  }

  private alRegistrar(respuesta: RespuestaRegistro): void {
    // Antes de la confirmación, los códigos de recuperación: se ven una sola vez
    this.cuentaCreada = respuesta;
    this.codigosRecuperacion.set(respuesta.codigosRecuperacion);
    this.codigosGuardados.set(false);
    this.enviando.set(false);
    this.intentado.set(false);
    this.activacion.set(null);
    this.codigo.reset('');
    // Vacía el formulario, contraseñas incluidas, ahora que ya no hace falta.
    this.form.reset();
    this.fase.set('codigos');
    this.cdr.detectChanges();
    this.host.nativeElement.querySelector<HTMLElement>('.codigos-registro h2')?.focus();
  }

  private alFallar(error: unknown): void {
    this.enviando.set(false);
    if (!(error instanceof HttpErrorResponse)) {
      this.errorGeneral.set({ texto: TEXTOS_ERROR.generico });
      return;
    }
    const cuerpo = this.cuerpoDe(error);
    switch (error.status) {
      case 0:
        this.errorGeneral.set({ texto: TEXTOS_ERROR.sinConexion });
        break;
      case 400:
        this.alFallarValidacion(cuerpo['errores']);
        break;
      case 409:
        // Hay que cambiar algo de los datos: se vuelve a ellos
        this.fase.set('datos');
        this.activacion.set(null);
        this.errorGeneral.set({ texto: TEXTOS_ERROR.noCompletado });
        break;
      case 429:
        this.errorGeneral.set({ texto: TEXTOS_ERROR.demasiadosIntentos });
        this.iniciarEspera(this.segundosDeEspera(error));
        break;
      case 503:
        this.errorGeneral.set({
          texto: TEXTOS_ERROR.servicioNoDisponible,
          referencia: this.referenciaDe(error, cuerpo),
        });
        break;
      case 500:
        this.errorGeneral.set({
          texto: TEXTOS_ERROR.errorInesperado,
          referencia: this.referenciaDe(error, cuerpo),
        });
        break;
      default:
        this.errorGeneral.set({ texto: TEXTOS_ERROR.generico });
    }
  }

  // 400 con {"errores": {campo: [códigos]}}: cada código se pinta junto a su campo.
  private alFallarValidacion(errores: unknown): void {
    if (typeof errores !== 'object' || errores === null) {
      this.errorGeneral.set({ texto: TEXTOS_ERROR.peticionInvalida });
      return;
    }
    if (this.fase() === 'verificacion') {
      if (this.alFallarVerificacion(errores)) {
        return;
      }
      // Fallan los datos: se vuelve a ellos para corregirlos
      this.fase.set('datos');
      this.activacion.set(null);
      // Al volver a pintarse, cada campo se enlaza con su control y borraría los errores puestos a mano: se pinta antes
      this.cdr.detectChanges();
    }
    const sinCampo: string[] = [];
    for (const [campo, valor] of Object.entries(errores)) {
      if (campo !== 'codigoDosFactores') {
        sinCampo.push(...this.pintarErroresDelCampo(campo, valor));
      }
    }
    this.errorGeneral.set({
      texto: sinCampo.length > 0 ? sinCampo.join(' ') : TEXTOS_ERROR.revisaCampos,
    });
    this.enfocarPrimerError();
  }

  // Errores del paso del código. Devuelve true si quedan resueltos aquí y no hay que volver a los datos.
  private alFallarVerificacion(errores: object): boolean {
    const deCodigo = this.codigosDe(errores, 'codigoDosFactores');
    if (deCodigo.length === 0) {
      return false;
    }
    if (deCodigo.includes('ACTIVACION_NO_VIGENTE')) {
      // El secreto caducó o se agotaron los intentos: hay que pedir otro QR desde los datos
      this.volverALosDatos();
      this.errorGeneral.set({ texto: TEXTOS_ERROR.activacionNoVigente });
      return true;
    }
    if (Object.keys(errores).length === 1) {
      // Solo falla el código: se queda en este paso para reintentarlo
      this.errorCodigo.set([...new Set(deCodigo.map((c) => mensajeDe('codigoDosFactores', c)))].join(' '));
      this.enfocarCodigo();
      return true;
    }
    return false;
  }

  // Pinta los códigos junto a su campo. Devuelve los mensajes de los que no tienen campo donde mostrarse.
  private pintarErroresDelCampo(campo: string, valor: unknown): string[] {
    const codigos = Array.isArray(valor) ? valor.filter((c): c is string => typeof c === 'string') : [];
    const control = this.form.get(campo);
    if (control?.enabled && codigos.length > 0) {
      // Los errores puestos a mano duran hasta que el usuario edita ese campo.
      control.setErrors(Object.fromEntries(codigos.map((codigo) => [codigo, true])));
      control.markAsTouched();
      return [];
    }
    return codigos.map((codigo) => mensajeDe(campo, codigo));
  }

  private codigosDe(errores: object, campo: string): string[] {
    const valor = (errores as Record<string, unknown>)[campo];
    return Array.isArray(valor) ? valor.filter((c): c is string => typeof c === 'string') : [];
  }

  // Quita los errores que puso el servidor en el intento anterior: si siguen mal, volverá a decirlo.
  private descartarErroresDelServidor(): void {
    for (const control of Object.values(this.form.controls)) {
      control.updateValueAndValidity({ onlySelf: true, emitEvent: false });
    }
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  private enfocarPrimerError(): void {
    this.cdr.detectChanges();
    this.host.nativeElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }

  private iniciarEspera(segundos: number): void {
    this.detenerEspera();
    this.esperaSegundos.set(segundos);
    this.temporizador = setInterval(() => {
      const restante = this.esperaSegundos() - 1;
      this.esperaSegundos.set(Math.max(restante, 0));
      if (restante <= 0) {
        this.detenerEspera();
        this.errorGeneral.set(null);
      }
    }, 1000);
  }

  private detenerEspera(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  // El backend indica en Retry-After los segundos que quedan de la ventana de límite.
  private segundosDeEspera(error: HttpErrorResponse): number {
    const segundos = Number.parseInt(error.headers.get('Retry-After') ?? '', 10);
    return Number.isFinite(segundos) && segundos > 0 ? segundos : SEGUNDOS_ESPERA_POR_DEFECTO;
  }

  private referenciaDe(
    error: HttpErrorResponse,
    cuerpo: Record<string, unknown>,
  ): string | undefined {
    const deCuerpo = cuerpo['correlationId'];
    if (typeof deCuerpo === 'string') {
      return deCuerpo;
    }
    return error.headers.get('X-Correlation-Id') ?? undefined;
  }

  private cuerpoDe(error: HttpErrorResponse): Record<string, unknown> {
    return typeof error.error === 'object' && error.error !== null
      ? (error.error as Record<string, unknown>)
      : {};
  }
}
