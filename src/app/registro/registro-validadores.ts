import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Réplica en el navegador de las reglas del backend, solo para avisar antes de enviar: el servidor
// vuelve a validar todo y es quien decide. Los errores usan los mismos códigos que devuelve el backend
// (OBLIGATORIO, FORMATO_INVALIDO...), así un fallo local y uno del servidor se muestran igual.

export const LONGITUD_MAXIMA_TEXTO = 100;
export const LONGITUD_MAXIMA_EMAIL = 254;
export const CONTRASENA_LONGITUD_MINIMA = 12;
export const CONTRASENA_LONGITUD_MAXIMA = 128;
export const EDAD_MINIMA = 18;
export const EDAD_MAXIMA = 120;

// Caracteres que el backend rechaza en nombres: se usan en XSS y en operadores NoSQL.
const CARACTERES_PROHIBIDOS = /[<>{}$]/;
const FORMATO_EMAIL = /^[a-z0-9._%+-]+@(?:[a-z0-9-]+\.)+[a-z]{2,}$/i;
const FORMATO_TELEFONO = /^[0-9]{9}$/;

// Composición de la contraseña, igual que el backend: un dígito 0-9, una mayúscula y una minúscula (Unicode, con
// acentos y la ñ) y un carácter especial, que es cualquier signo de puntuación o símbolo (un emoji cuenta; los
// espacios no).
const HAY_NUMERO = /[0-9]/;
const HAY_MAYUSCULA = /\p{Lu}/u;
const HAY_MINUSCULA = /\p{Ll}/u;
const HAY_ESPECIAL = /[\p{P}\p{S}]/u;

const vacio = (valor: unknown): boolean => typeof valor !== 'string' || valor.trim() === '';

// Longitud en caracteres reales: un emoji cuenta como 1, igual que en el backend.
const longitud = (valor: string): number => [...valor].length;

// Texto obligatorio de hasta 100 caracteres y sin caracteres peligrosos (nombre, apellidos, DNI...).
export function textoObligatorio(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (vacio(valor)) {
      return { OBLIGATORIO: true };
    }
    const texto = (valor as string).trim();
    if (longitud(texto) > LONGITUD_MAXIMA_TEXTO) {
      return { LONGITUD_EXCESIVA: true };
    }
    return CARACTERES_PROHIBIDOS.test(texto) ? { FORMATO_INVALIDO: true } : null;
  };
}

export function emailValido(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (vacio(valor)) {
      return { OBLIGATORIO: true };
    }
    const email = (valor as string).trim();
    if (email.length > LONGITUD_MAXIMA_EMAIL) {
      return { LONGITUD_EXCESIVA: true };
    }
    return FORMATO_EMAIL.test(email) ? null : { FORMATO_INVALIDO: true };
  };
}

// El teléfono es opcional; si se rellena, deben ser exactamente 9 dígitos.
export function telefonoOpcional(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (vacio(valor)) {
      return null;
    }
    return FORMATO_TELEFONO.test((valor as string).trim()) ? null : { TELEFONO_INVALIDO: true };
  };
}

// La contraseña no se recorta: los espacios forman parte de ella y se permiten. Como en el backend, se devuelven
// todos los incumplimientos a la vez (longitud y composición) y se valida sobre el texto normalizado a NFC.
export function contrasenaValida(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (typeof valor !== 'string' || valor === '') {
      return { OBLIGATORIO: true };
    }
    const contrasena = valor.normalize('NFC');
    const errores: ValidationErrors = {};
    const largo = longitud(contrasena);
    if (largo < CONTRASENA_LONGITUD_MINIMA) {
      errores['CONTRASENA_CORTA'] = true;
    } else if (largo > CONTRASENA_LONGITUD_MAXIMA) {
      errores['CONTRASENA_LARGA'] = true;
    }
    if (!HAY_NUMERO.test(contrasena)) {
      errores['CONTRASENA_SIN_NUMERO'] = true;
    }
    if (!HAY_ESPECIAL.test(contrasena)) {
      errores['CONTRASENA_SIN_CARACTER_ESPECIAL'] = true;
    }
    if (!HAY_MAYUSCULA.test(contrasena)) {
      errores['CONTRASENA_SIN_MAYUSCULA'] = true;
    }
    if (!HAY_MINUSCULA.test(contrasena)) {
      errores['CONTRASENA_SIN_MINUSCULA'] = true;
    }
    return Object.keys(errores).length > 0 ? errores : null;
  };
}

// Casilla de condiciones de uso: solo se comprueba en el navegador, no viaja al backend.
export const condicionesAceptadas: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => (control.value === true ? null : { CONDICIONES_NO_ACEPTADAS: true });

// Se coloca en el grupo del formulario: la repetición debe ser idéntica, mayúsculas incluidas.
export const contrasenasCoinciden: ValidatorFn = (
  grupo: AbstractControl,
): ValidationErrors | null => {
  const contrasena = grupo.get('contrasena')?.value;
  const repeticion = grupo.get('repetirContrasena')?.value;
  return repeticion && contrasena !== repeticion ? { CONTRASENAS_NO_COINCIDEN: true } : null;
};

// Fecha de hoy en la zona de la aplicación (Europe/Madrid), como AAAA-MM-DD. El backend calcula la edad
// con esa zona, así que se usa también aquí para que ambos coincidan cerca de medianoche.
export function hoyEnMadrid(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

// Misma fecha de hace n años. Al comparar cadenas AAAA-MM-DD, quien nació un 29 de febrero cumple años
// el 1 de marzo en los años no bisiestos, igual que con Period.between del backend.
export function haceAnios(fecha: string, anios: number): string {
  return `${Number(fecha.slice(0, 4)) - anios}${fecha.slice(4)}`;
}

export function fechaNacimientoValida(hoy: () => string = hoyEnMadrid): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const fecha = control.value;
    if (vacio(fecha)) {
      return { OBLIGATORIO: true };
    }
    const hoyIso = hoy();
    if (fecha > hoyIso || fecha < haceAnios(hoyIso, EDAD_MAXIMA)) {
      return { FECHA_INVALIDA: true };
    }
    return fecha > haceAnios(hoyIso, EDAD_MINIMA) ? { MENOR_DE_EDAD: true } : null;
  };
}
