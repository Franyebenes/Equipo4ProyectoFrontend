export interface HomeInfo {
  nombre: string;
  descripcion: string;
  version: string;
  caracteristicas: string[];
  contacto: {
    email: string;
    telefono: string;
  };
}
