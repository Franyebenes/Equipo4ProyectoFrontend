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
import { Categoria, RespuestaRegistro, SolicitudRegistro } from './registro-api';
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
  // El backend responde igual esté o no registrado el email, para no revelar qué cuentas existen.
  noCompletado: 'No se ha podido completar el registro con los datos proporcionados.',
} as const;

// Página de registro de clientes y vendedores. Envía el formulario a POST /api/auth/registro.
@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, NgTemplateOutlet, RouterLink],
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
  readonly categorias = signal<Categoria[]>([]);
  readonly estadoCategorias = signal<'inicial' | 'cargando' | 'listo' | 'error'>('inicial');
  readonly avatares = AVATARES;

  // Los campos de vendedor empiezan deshabilitados: un control deshabilitado no cuenta para la validez.
  readonly form = this.fb.group(
    {
      nombre: ['', [textoObligatorio()]],
      apellidos: ['', [textoObligatorio()]],
      dni: ['', [textoObligatorio()]],
      email: ['', [emailValido()]],
      telefono: ['', [telefonoOpcional()]],
      fechaNacimiento: ['', [fechaNacimientoValida()]],
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

  constructor() {
    inject(DestroyRef).onDestroy(() => this.detenerEspera());
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
    this.enviando.set(true);
    this.api.registrar(this.construirSolicitud()).subscribe({
      next: (respuesta) => this.alRegistrar(respuesta),
      error: (error: unknown) => this.alFallar(error),
    });
  }

  // Solo viajan los campos de su tipo de cuenta: el backend rechaza los que no le corresponden.
  private construirSolicitud(): SolicitudRegistro {
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
    };
    if (this.rol() === 'vendedor') {
      return {
        tipoCuenta: 'VENDEDOR',
        ...comunes,
        nombreComercial: valores.nombreComercial.trim(),
        categoriaPrincipalId: valores.categoriaPrincipalId,
      };
    }
    return { tipoCuenta: 'CLIENTE', ...comunes, fechaNacimiento: valores.fechaNacimiento };
  }

  private alRegistrar(respuesta: RespuestaRegistro): void {
    this.confirmacion.set(respuesta);
    this.enviando.set(false);
    this.intentado.set(false);
    // Vacía el formulario, contraseñas incluidas, ahora que ya no hace falta.
    this.form.reset();
    // El formulario era largo y la confirmación es corta: el foco la trae a la vista y la anuncia.
    this.cdr.detectChanges();
    this.host.nativeElement.querySelector<HTMLElement>('.confirmacion h2')?.focus();
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
    const sinCampo: string[] = [];
    for (const [campo, valor] of Object.entries(errores)) {
      const codigos = Array.isArray(valor)
        ? valor.filter((codigo): codigo is string => typeof codigo === 'string')
        : [];
      const control = this.form.get(campo);
      if (control?.enabled && codigos.length > 0) {
        // Los errores puestos a mano duran hasta que el usuario edita ese campo.
        control.setErrors(Object.fromEntries(codigos.map((codigo) => [codigo, true])));
        control.markAsTouched();
      } else {
        sinCampo.push(...codigos.map((codigo) => mensajeDe(campo, codigo)));
      }
    }
    this.errorGeneral.set({
      texto: sinCampo.length > 0 ? sinCampo.join(' ') : TEXTOS_ERROR.revisaCampos,
    });
    this.enfocarPrimerError();
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
