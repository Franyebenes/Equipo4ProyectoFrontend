// Caracteres permitidos en el nombre y la descripción de categorías y productos (sin caracteres especiales).
// Mismas reglas que Constantes.PATRON_NOMBRE y Constantes.PATRON_DESCRIPCION en el backend.

// Nombre: letras (también con tilde, ñ o ü), números y espacios.
const PATRON_NOMBRE = /^[\p{L}\d ]+$/u;
// Descripción: lo mismo que el nombre, saltos de línea y los signos de puntuación . , ; : ¿ ? ¡ ! ( ) -
const PATRON_DESCRIPCION = /^[\p{L}\d \t\r\n.,;:¿?¡!()-]+$/u;

// Devuelve el error si el nombre o la descripción llevan caracteres especiales, o '' si son válidos.
export function errorCaracteresNoPermitidos(nombre: string, descripcion: string): string {
  if (!PATRON_NOMBRE.test(nombre)) {
    return 'El nombre solo puede contener letras, números y espacios.';
  }
  if (!PATRON_DESCRIPCION.test(descripcion)) {
    return 'La descripción solo puede contener letras, números, espacios y los signos . , ; : ¿ ? ¡ ! ( ) -';
  }
  return '';
}