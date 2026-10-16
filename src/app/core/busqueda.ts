// Búsqueda en los listados sin distinguir mayúsculas ni tildes: «electronica» encuentra «Electrónica».

export function normalizarTexto(texto: string): string {
  // NFD separa cada letra de su tilde (á = a + ´) y luego se quitan las tildes
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// true si el texto contiene lo buscado. Una búsqueda vacía coincide con todo.
export function coincideBusqueda(texto: string, busqueda: string): boolean {
  return normalizarTexto(texto).includes(normalizarTexto(busqueda));
}
