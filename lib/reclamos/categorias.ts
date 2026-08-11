/** Las categorías de daño, como se nombran en pantalla (§5.2). */
export const ETIQUETA_CATEGORIA: Record<string, string> = {
  mobiliario: "Daño a mobiliario",
  electrodomestico: "Rotura de electrodoméstico",
  limpieza_extraordinaria: "Limpieza extraordinaria",
  faltante: "Faltante",
  edilicio: "Daño edilicio",
  huespedes_no_declarados: "Huéspedes no declarados",
  otro: "Otro",
};

/** En el orden en que se ofrecen en el desplegable. */
export const CATEGORIAS = [
  "mobiliario",
  "electrodomestico",
  "limpieza_extraordinaria",
  "faltante",
  "edilicio",
  "huespedes_no_declarados",
  "otro",
] as const;
