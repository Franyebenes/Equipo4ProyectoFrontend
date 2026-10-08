import {
  CONTRASENA_LONGITUD_MAXIMA,
  CONTRASENA_LONGITUD_MINIMA,
  EDAD_MINIMA,
  LONGITUD_MAXIMA_EMAIL,
  LONGITUD_MAXIMA_TEXTO,
} from './registro-validadores';

// Mensajes para el usuario según el código de error. Valen para los errores locales y para los que
// devuelve el backend, que usan los mismos códigos.
const MENSAJES: Record<string, string> = {
  OBLIGATORIO: 'Este campo es obligatorio.',
  FORMATO_INVALIDO: 'El formato no es válido.',
  LONGITUD_EXCESIVA: `Es demasiado largo (máximo ${LONGITUD_MAXIMA_TEXTO} caracteres).`,
  MENOR_DE_EDAD: `Debes ser mayor de ${EDAD_MINIMA} años para registrarte.`,
  FECHA_INVALIDA: 'La fecha de nacimiento no es válida.',
  DOMINIO_EMAIL_INEXISTENTE:
    'El dominio de este correo no puede recibir emails. Revisa que esté bien escrito.',
  TELEFONO_INVALIDO: 'Introduce 9 dígitos, sin espacios ni prefijo.',
  AVATAR_NO_PERMITIDO: 'Elige uno de los avatares disponibles.',
  CATEGORIA_INEXISTENTE: 'Elige una categoría de la lista.',
  NOMBRE_COMERCIAL_DUPLICADO: 'Ya existe una tienda con ese nombre.',
  CONTRASENAS_NO_COINCIDEN: 'Las contraseñas no coinciden.',
  CONDICIONES_NO_ACEPTADAS: 'Debes aceptar las condiciones para crear la cuenta.',
  CONTRASENA_CORTA: `La contraseña debe tener al menos ${CONTRASENA_LONGITUD_MINIMA} caracteres.`,
  CONTRASENA_LARGA: `La contraseña no puede superar los ${CONTRASENA_LONGITUD_MAXIMA} caracteres.`,
  CONTRASENA_COMUN: 'Es una contraseña muy común. Elige otra menos predecible.',
  CONTRASENA_FILTRADA: 'Esta contraseña aparece en filtraciones públicas de datos. Elige otra.',
  CONTRASENA_CON_DATOS_PERSONALES:
    'No uses tu nombre, apellidos, correo, nombre comercial ni «esibuy» en la contraseña.',
};

const SIN_CARACTERES_PELIGROSOS = 'No uses los caracteres < > { } $.';

// Un mismo código dice cosas distintas según el campo.
const MENSAJES_POR_CAMPO: Record<string, Record<string, string>> = {
  nombre: { FORMATO_INVALIDO: SIN_CARACTERES_PELIGROSOS },
  apellidos: { FORMATO_INVALIDO: SIN_CARACTERES_PELIGROSOS },
  dni: { FORMATO_INVALIDO: SIN_CARACTERES_PELIGROSOS },
  nombreComercial: { FORMATO_INVALIDO: SIN_CARACTERES_PELIGROSOS },
  email: {
    FORMATO_INVALIDO: 'Introduce un correo válido, como nombre@correo.es.',
    LONGITUD_EXCESIVA: `Es demasiado largo (máximo ${LONGITUD_MAXIMA_EMAIL} caracteres).`,
  },
  fechaNacimiento: { FORMATO_INVALIDO: 'Introduce una fecha válida.' },
  categoriaPrincipalId: { FORMATO_INVALIDO: 'Elige una categoría de la lista.' },
};

const MENSAJE_DESCONOCIDO = 'El valor introducido no es válido.';

export function mensajeDe(campo: string, codigo: string): string {
  return MENSAJES_POR_CAMPO[campo]?.[codigo] ?? MENSAJES[codigo] ?? MENSAJE_DESCONOCIDO;
}
