// Contrato con el backend: primero POST /api/auth/registro/2fa (QR) y después POST /api/auth/registro. El campo tipoCuenta decide qué datos se leen:
// CLIENTE y PREMIUM llevan fechaNacimiento; VENDEDOR lleva nombreComercial y categoriaPrincipalId.
// Cualquier campo que no sea de su tipo se rechaza con 400, así que cada solicitud lleva solo los suyos.
export type TipoCuenta = 'CLIENTE' | 'PREMIUM' | 'VENDEDOR';

interface DatosComunes {
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string | null;
  // Opcional: sin avatar, el backend asigna el de por defecto.
  avatar?: string | null;
  contrasena: string;
  repetirContrasena: string;
  // Primer código de la aplicación autenticadora: prueba que el 2FA está configurado. Es obligatorio.
  codigoDosFactores: string;
}

export interface SolicitudRegistroCliente extends DatosComunes {
  tipoCuenta: 'CLIENTE' | 'PREMIUM';
  fechaNacimiento: string; // AAAA-MM-DD, tal cual lo da <input type="date">
}

export interface SolicitudRegistroVendedor extends DatosComunes {
  tipoCuenta: 'VENDEDOR';
  nombreComercial: string;
  categoriaPrincipalId: string;
}

export type SolicitudRegistro = SolicitudRegistroCliente | SolicitudRegistroVendedor;

export interface RespuestaRegistro {
  id: string;
  email: string;
  nombre: string;
  mensaje: string;
  // Se muestran una sola vez: en el servidor solo queda su hash.
  codigosRecuperacion: string[];
}

// POST /api/auth/registro/2fa: lo necesario para dar de alta la cuenta en la aplicación autenticadora.
export interface ActivacionRegistro {
  uri: string; // otpauth://..., para el QR
  secreto: string; // el mismo secreto en Base32, para escribirlo a mano
}

export interface Categoria {
  id: string;
  nombre: string;
}

// Cuerpo de un 400 de validación: todos los errores a la vez, por campo.
export interface ErroresValidacion {
  errores: Record<string, string[]>;
}
