import { FormControl, FormGroup } from '@angular/forms';
import {
  condicionesAceptadas,
  contrasenasCoinciden,
  contrasenaValida,
  emailValido,
  fechaNacimientoValida,
  haceAnios,
  hoyEnMadrid,
  telefonoOpcional,
  textoObligatorio,
} from './registro-validadores';

const errorDe = (validador: (c: FormControl) => unknown, valor: unknown) =>
  validador(new FormControl(valor));

describe('textoObligatorio', () => {
  const validar = textoObligatorio();

  it.each([[''], ['   '], [null]])('rechaza el valor vacío %j como obligatorio', (valor) => {
    expect(errorDe(validar, valor)).toEqual({ OBLIGATORIO: true });
  });

  it('acepta un texto normal, también con acentos y espacios en los extremos', () => {
    expect(errorDe(validar, '  García López ')).toBeNull();
  });

  it('acepta 100 caracteres y rechaza 101', () => {
    expect(errorDe(validar, 'a'.repeat(100))).toBeNull();
    expect(errorDe(validar, 'a'.repeat(101))).toEqual({ LONGITUD_EXCESIVA: true });
  });

  it.each([['<script>'], ['{"$gt":""}'], ['a$b'], ['a}b']])(
    'rechaza los caracteres peligrosos en %j',
    (valor) => {
      expect(errorDe(validar, valor)).toEqual({ FORMATO_INVALIDO: true });
    },
  );
});

describe('emailValido', () => {
  const validar = emailValido();

  it('acepta un correo válido, con mayúsculas y espacios en los extremos', () => {
    expect(errorDe(validar, ' Ana.Garcia@Ejemplo.ES ')).toBeNull();
  });

  it.each([['sin-arroba'], ['a@'], ['a@@b.com'], ['a b@c.com'], ['@dominio.es'], ['usuario@']])(
    'rechaza el formato de %j',
    (valor) => {
      expect(errorDe(validar, valor)).toEqual({ FORMATO_INVALIDO: true });
    },
  );

  it('exige el correo y limita su longitud a 254 caracteres', () => {
    expect(errorDe(validar, '')).toEqual({ OBLIGATORIO: true });
    expect(errorDe(validar, `${'a'.repeat(250)}@b.es`)).toEqual({ LONGITUD_EXCESIVA: true });
  });
});

describe('telefonoOpcional', () => {
  const validar = telefonoOpcional();

  it.each([[''], [null], ['   '], ['612345678'], [' 912345678 ']])('acepta %j', (valor) => {
    expect(errorDe(validar, valor)).toBeNull();
  });

  it.each([['12345678'], ['6123456789'], ['61234567a'], ['+34612345678'], ['612 345 678']])(
    'rechaza %j',
    (valor) => {
      expect(errorDe(validar, valor)).toEqual({ TELEFONO_INVALIDO: true });
    },
  );
});

describe('contrasenaValida', () => {
  const validar = contrasenaValida();

  it('exige la contraseña', () => {
    expect(errorDe(validar, '')).toEqual({ OBLIGATORIO: true });
  });

  it('acepta 12 caracteres y rechaza 11', () => {
    expect(errorDe(validar, 'a'.repeat(12))).toBeNull();
    expect(errorDe(validar, 'a'.repeat(11))).toEqual({ CONTRASENA_CORTA: true });
  });

  it('acepta 128 caracteres y rechaza 129', () => {
    expect(errorDe(validar, 'a'.repeat(128))).toBeNull();
    expect(errorDe(validar, 'a'.repeat(129))).toEqual({ CONTRASENA_LARGA: true });
  });

  it('cuenta los emojis como un carácter, igual que el backend', () => {
    expect(errorDe(validar, '😀'.repeat(128))).toBeNull();
    expect(errorDe(validar, '😀'.repeat(129))).toEqual({ CONTRASENA_LARGA: true });
  });

  it('no recorta los espacios: forman parte de la contraseña', () => {
    expect(errorDe(validar, ' '.repeat(12))).toBeNull();
  });

  it('no impone reglas de composición (mayúsculas, números, símbolos)', () => {
    expect(errorDe(validar, 'solo minusculas y espacios')).toBeNull();
  });
});

describe('contrasenasCoinciden', () => {
  const grupo = (contrasena: string, repeticion: string) =>
    new FormGroup(
      { contrasena: new FormControl(contrasena), repetirContrasena: new FormControl(repeticion) },
      { validators: [contrasenasCoinciden] },
    );

  it('acepta contraseñas idénticas', () => {
    expect(grupo('Tren-Azul-77', 'Tren-Azul-77').errors).toBeNull();
  });

  it('rechaza contraseñas distintas, también si solo cambian las mayúsculas', () => {
    expect(grupo('Tren-Azul-77', 'Tren-Azul-78').errors).toEqual({
      CONTRASENAS_NO_COINCIDEN: true,
    });
    expect(grupo('Tren-Azul-77', 'tren-azul-77').errors).toEqual({
      CONTRASENAS_NO_COINCIDEN: true,
    });
  });

  it('no avisa mientras la repetición está vacía (eso ya lo dice «obligatorio»)', () => {
    expect(grupo('Tren-Azul-77', '').errors).toBeNull();
  });
});

describe('condicionesAceptadas', () => {
  it('solo acepta la casilla marcada', () => {
    expect(errorDe(condicionesAceptadas, true)).toBeNull();
    expect(errorDe(condicionesAceptadas, false)).toEqual({ CONDICIONES_NO_ACEPTADAS: true });
  });
});

describe('fechaNacimientoValida', () => {
  // Mismos casos que ServicioRegistroEdadTest del backend.
  const conHoy = (hoy: string) => fechaNacimientoValida(() => hoy);

  it('exige la fecha', () => {
    expect(errorDe(conHoy('2026-10-01'), '')).toEqual({ OBLIGATORIO: true });
  });

  it('acepta a quien cumple 18 años hoy', () => {
    expect(errorDe(conHoy('2026-10-01'), '2008-10-01')).toBeNull();
  });

  it('rechaza como menor a quien cumple 18 años mañana', () => {
    expect(errorDe(conHoy('2026-10-01'), '2008-10-02')).toEqual({ MENOR_DE_EDAD: true });
  });

  it('rechaza como menor a un niño de 15 años', () => {
    expect(errorDe(conHoy('2026-10-01'), '2011-10-01')).toEqual({ MENOR_DE_EDAD: true });
  });

  it('rechaza una fecha futura como inválida, no como menor', () => {
    expect(errorDe(conHoy('2026-10-01'), '2026-10-02')).toEqual({ FECHA_INVALIDA: true });
  });

  it('rechaza una fecha de hace más de 120 años', () => {
    expect(errorDe(conHoy('2026-10-01'), '1850-01-01')).toEqual({ FECHA_INVALIDA: true });
    expect(errorDe(conHoy('2026-10-01'), '1906-10-01')).toBeNull();
  });

  it('trata el 29 de febrero: cumple 18 el 1 de marzo en un año no bisiesto', () => {
    expect(errorDe(conHoy('2026-02-28'), '2008-02-29')).toEqual({ MENOR_DE_EDAD: true });
    expect(errorDe(conHoy('2026-03-01'), '2008-02-29')).toBeNull();
  });

  it('acepta el 29 de febrero en un año bisiesto', () => {
    expect(errorDe(conHoy('2028-02-29'), '2008-02-29')).toBeNull();
  });
});

describe('hoyEnMadrid', () => {
  it('usa la fecha de Madrid aunque en UTC sea todavía el día anterior', () => {
    // 22:30 UTC del 1 de octubre ya es 00:30 del 2 de octubre en Madrid (UTC+2).
    expect(hoyEnMadrid(new Date('2026-10-01T22:30:00Z'))).toBe('2026-10-02');
    expect(hoyEnMadrid(new Date('2026-10-01T21:30:00Z'))).toBe('2026-10-01');
  });
});

describe('haceAnios', () => {
  it('resta años conservando mes y día', () => {
    expect(haceAnios('2026-10-01', 18)).toBe('2008-10-01');
  });
});
