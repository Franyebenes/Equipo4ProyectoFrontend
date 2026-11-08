import { coincideBusqueda, normalizarTexto } from './busqueda';

describe('normalizarTexto', () => {
  it('quita tildes, diéresis y mayúsculas', () => {
    expect(normalizarTexto('  Electrónica Pingüino ÑANDÚ ')).toBe('electronica pinguino nandu');
  });
});

describe('coincideBusqueda', () => {
  it('encuentra el texto sin distinguir mayúsculas ni tildes', () => {
    expect(coincideBusqueda('Lámpara de pie', 'lampara')).toBe(true);
    expect(coincideBusqueda('Electrónica', 'TRÓNI')).toBe(true);
  });

  it('una búsqueda vacía o de espacios coincide con todo', () => {
    expect(coincideBusqueda('Moda', '')).toBe(true);
    expect(coincideBusqueda('Moda', '   ')).toBe(true);
  });

  it('no encuentra lo que no aparece', () => {
    expect(coincideBusqueda('Moda', 'hogar')).toBe(false);
  });
});
