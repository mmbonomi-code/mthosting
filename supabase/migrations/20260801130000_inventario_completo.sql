-- ============================================================================
-- Inventario y distribución completos — docs/FASE-1-INVENTARIO-DEPARTAMENTOS.md
--
-- Reemplaza el borrador de camas que había quedado en distribucion_depto:
--
-- 1. DISTRIBUCIÓN = cantidades, como columnas del departamento: camas por
--    tipo y hasta tres baños con detalle. El total de camas y la cantidad de
--    baños son DERIVADOS (columnas generadas), nunca se cargan a mano.
-- 2. EQUIPAMIENTO = tiene / no tiene + detalle opcional, contra un catálogo
--    de ítems agrupado por categoría.
-- 3. distribucion_depto vuelve a su forma original (depto ↔ persona).
-- ============================================================================

-- --- 1. Distribución: cantidades en el departamento --------------------------

alter table departamentos
  add column camas_king integer not null default 0,
  add column camas_queen integer not null default 0,
  add column camas_twin integer not null default 0,
  add column sillon_cama integer not null default 0,
  add column bano_1 text,
  add column bano_2 text,
  add column bano_3 text;

-- Derivados: no editables, siempre consistentes con las cantidades cargadas.
alter table departamentos
  drop column banos,
  add column total_camas integer
    generated always as (camas_king + camas_queen + camas_twin + sillon_cama) stored,
  add column cantidad_banos integer
    generated always as (
      (case when bano_1 is not null then 1 else 0 end)
      + (case when bano_2 is not null then 1 else 0 end)
      + (case when bano_3 is not null then 1 else 0 end)
    ) stored;

-- distribucion_depto vuelve a su forma original: qué persona atiende qué depto.
alter table distribucion_depto
  drop column ambiente,
  drop column tipo_cama,
  drop column cantidad,
  add column persona_id uuid references personas (id);

drop type tipo_cama;

-- --- 2. Equipamiento: catálogo + tiene/no-tiene por departamento -------------

alter table item_catalogo add column orden integer not null default 0;

alter table inventario_depto
  drop column cantidad,
  drop column notas,
  add column tiene boolean not null default false,
  add column detalle text,
  add constraint inventario_depto_unico unique (depto_id, item_id);

-- Catálogo inicial, agrupado como se muestra en la ficha.
insert into item_catalogo (nombre, categoria, orden) values
  ('Aire habitación 1', 'Climatización', 10),
  ('Aire habitación 2', 'Climatización', 20),
  ('Aire habitación 3', 'Climatización', 30),
  ('Aire living', 'Climatización', 40),
  ('Calefacción', 'Climatización', 50),
  ('Agua caliente', 'Climatización', 60),

  ('Cocina', 'Cocina', 10),
  ('Heladera', 'Cocina', 20),
  ('Microondas', 'Cocina', 30),
  ('Pava', 'Cocina', 40),
  ('Cafetera', 'Cocina', 50),
  ('Tostadora', 'Cocina', 60),
  ('Sanguchera', 'Cocina', 70),
  ('Hornito eléctrico', 'Cocina', 80),
  ('Licuadora', 'Cocina', 90),

  ('Lavarropas', 'Lavado', 10),
  ('Tender', 'Lavado', 20),
  ('Plancha', 'Lavado', 30),
  ('Tabla de planchar', 'Lavado', 40),
  ('Aspiradora', 'Lavado', 50),
  ('Laundry', 'Lavado', 60),

  ('TV', 'Otros', 10),
  ('Balcón', 'Otros', 20),
  ('Perchas', 'Otros', 30),
  ('Basura', 'Otros', 40),
  ('Secador de pelo', 'Otros', 50),
  ('Frazadas', 'Otros', 60),
  ('Estacionamiento', 'Otros', 70),
  ('Velocidad de wifi', 'Otros', 80),

  ('Pileta', 'Edificio', 10),
  ('Gimnasio', 'Edificio', 20),
  ('Sauna', 'Edificio', 30);

create index idx_inventario_depto on inventario_depto (depto_id);
