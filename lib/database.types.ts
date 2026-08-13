export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      archivos_economico: {
        Row: {
          created_at: string
          error: string | null
          filas_duplicadas: number
          filas_leidas: number
          filas_nuevas: number
          filas_sin_mapear: number
          hash: string
          id: string
          import_id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          filas_duplicadas?: number
          filas_leidas?: number
          filas_nuevas?: number
          filas_sin_mapear?: number
          hash: string
          id?: string
          import_id: string
          nombre: string
        }
        Update: {
          created_at?: string
          error?: string | null
          filas_duplicadas?: number
          filas_leidas?: number
          filas_nuevas?: number
          filas_sin_mapear?: number
          hash?: string
          id?: string
          import_id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "archivos_economico_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "importaciones_economico"
            referencedColumns: ["id"]
          },
        ]
      }
      arreglo_fotos: {
        Row: {
          arreglo_id: string
          comentario: string | null
          created_at: string
          id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          arreglo_id: string
          comentario?: string | null
          created_at?: string
          id?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          arreglo_id?: string
          comentario?: string | null
          created_at?: string
          id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arreglo_fotos_arreglo_id_fkey"
            columns: ["arreglo_id"]
            isOneToOne: false
            referencedRelation: "arreglos"
            referencedColumns: ["id"]
          },
        ]
      }
      arreglos: {
        Row: {
          activo: boolean
          costo_moneda: string | null
          costo_monto: number | null
          created_at: string
          depto_id: string
          descripcion: string
          estado: string | null
          fecha: string | null
          id: string
          limpieza_id: string | null
          notas: string | null
          prestador_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          costo_moneda?: string | null
          costo_monto?: number | null
          created_at?: string
          depto_id: string
          descripcion: string
          estado?: string | null
          fecha?: string | null
          id?: string
          limpieza_id?: string | null
          notas?: string | null
          prestador_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          costo_moneda?: string | null
          costo_monto?: number | null
          created_at?: string
          depto_id?: string
          descripcion?: string
          estado?: string | null
          fecha?: string | null
          id?: string
          limpieza_id?: string | null
          notas?: string | null
          prestador_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arreglos_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arreglos_limpieza_id_fkey"
            columns: ["limpieza_id"]
            isOneToOne: false
            referencedRelation: "limpiezas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arreglos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          accion: string
          at: string
          diff: Json | null
          id: string
          registro_id: string | null
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          at?: string
          diff?: Json | null
          id?: string
          registro_id?: string | null
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          at?: string
          diff?: Json | null
          id?: string
          registro_id?: string | null
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      banos_depto: {
        Row: {
          created_at: string
          depto_id: string
          detalle: string | null
          id: string
          orden: number
          tipo: Database["public"]["Enums"]["tipo_bano"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          depto_id: string
          detalle?: string | null
          id?: string
          orden?: number
          tipo: Database["public"]["Enums"]["tipo_bano"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          depto_id?: string
          detalle?: string | null
          id?: string
          orden?: number
          tipo?: Database["public"]["Enums"]["tipo_bano"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "banos_depto_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueos: {
        Row: {
          activo: boolean
          created_at: string
          depto_id: string
          fecha_desde: string
          fecha_hasta: string
          id: string
          motivo: Database["public"]["Enums"]["bloqueo_motivo"]
          notas: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          depto_id: string
          fecha_desde: string
          fecha_hasta: string
          id?: string
          motivo: Database["public"]["Enums"]["bloqueo_motivo"]
          notas?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          depto_id?: string
          fecha_desde?: string
          fecha_hasta?: string
          id?: string
          motivo?: Database["public"]["Enums"]["bloqueo_motivo"]
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloqueos_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_movimiento: {
        Row: {
          activo: boolean
          created_at: string
          es_cambio: boolean
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          es_cambio?: boolean
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          es_cambio?: boolean
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      cobros_programados: {
        Row: {
          anuncio: string | null
          archivo: string
          categoria: Database["public"]["Enums"]["economico_categoria"]
          codigo_confirmacion: string | null
          created_at: string
          depto_id: string | null
          detalles: string | null
          fecha: string
          fecha_fin: string | null
          fecha_inicio: string | null
          fecha_reserva: string | null
          huella: string
          huesped: string | null
          id: string
          import_id: string
          importe: number | null
          ingresos_brutos: number | null
          linea: number
          materializado: boolean
          moneda: string
          monto: number | null
          noches: number | null
          ocurrencia: number
          orden_en_archivo: number
          raw: Json
          tarifa_limpieza: number | null
          tipo_raw: string
          updated_at: string
          vigente: boolean
        }
        Insert: {
          anuncio?: string | null
          archivo: string
          categoria: Database["public"]["Enums"]["economico_categoria"]
          codigo_confirmacion?: string | null
          created_at?: string
          depto_id?: string | null
          detalles?: string | null
          fecha: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_reserva?: string | null
          huella: string
          huesped?: string | null
          id?: string
          import_id: string
          importe?: number | null
          ingresos_brutos?: number | null
          linea: number
          materializado?: boolean
          moneda: string
          monto?: number | null
          noches?: number | null
          ocurrencia?: number
          orden_en_archivo: number
          raw: Json
          tarifa_limpieza?: number | null
          tipo_raw: string
          updated_at?: string
          vigente?: boolean
        }
        Update: {
          anuncio?: string | null
          archivo?: string
          categoria?: Database["public"]["Enums"]["economico_categoria"]
          codigo_confirmacion?: string | null
          created_at?: string
          depto_id?: string | null
          detalles?: string | null
          fecha?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_reserva?: string | null
          huella?: string
          huesped?: string | null
          id?: string
          import_id?: string
          importe?: number | null
          ingresos_brutos?: number | null
          linea?: number
          materializado?: boolean
          moneda?: string
          monto?: number | null
          noches?: number | null
          ocurrencia?: number
          orden_en_archivo?: number
          raw?: Json
          tarifa_limpieza?: number | null
          tipo_raw?: string
          updated_at?: string
          vigente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cobros_programados_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_programados_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "importaciones_economico"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          created_at: string
          fecha: string
          id: string
          tc: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha: string
          id?: string
          tc: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha?: string
          id?: string
          tc?: number
          updated_at?: string
        }
        Relationships: []
      }
      cuentas_payout: {
        Row: {
          activo: boolean
          clasificacion: Database["public"]["Enums"]["cuenta_clasificacion"]
          clave: string
          created_at: string
          id: string
          moneda: string | null
          notas: string | null
          numero: string | null
          tipo: string | null
          titular: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          clasificacion?: Database["public"]["Enums"]["cuenta_clasificacion"]
          clave: string
          created_at?: string
          id?: string
          moneda?: string | null
          notas?: string | null
          numero?: string | null
          tipo?: string | null
          titular?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          clasificacion?: Database["public"]["Enums"]["cuenta_clasificacion"]
          clave?: string
          created_at?: string
          id?: string
          moneda?: string | null
          notas?: string | null
          numero?: string | null
          tipo?: string | null
          titular?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cuentas_payout_alias: {
        Row: {
          created_at: string
          cuenta_id: string
          detalle_raw: string
          id: string
        }
        Insert: {
          created_at?: string
          cuenta_id: string
          detalle_raw: string
          id?: string
        }
        Update: {
          created_at?: string
          cuenta_id?: string
          detalle_raw?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_payout_alias_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_payout"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          activo: boolean
          acuerdo_pago: Database["public"]["Enums"]["acuerdo_pago"] | null
          airbnb_pass: string | null
          airbnb_user: string | null
          ambientes: Database["public"]["Enums"]["ambientes_tipo"] | null
          barrio: string | null
          camas_king: number
          camas_queen: number
          camas_twin: number
          capacidad: number | null
          codigo: string
          comision_pct: number | null
          created_at: string
          direccion: string | null
          encargado_nombre: string | null
          encargado_telefono: string | null
          estado: Database["public"]["Enums"]["depto_estado"]
          habitaciones: number | null
          ical_ultima_sync: string | null
          ical_url: string | null
          id: string
          indicaciones_acceso: string | null
          indicaciones_archivos: Json
          nombre_interno: string
          observacion: string | null
          propietario_id: string | null
          propietario_telefono: string | null
          requiere_aviso_seguridad: boolean
          requiere_registro: boolean
          self_checkout: Database["public"]["Enums"]["self_checkout_tipo"]
          sillon_cama: number
          total_camas: number | null
          trabajo_verificado: boolean
          updated_at: string
          url_mapa: string | null
          url_publicacion: string | null
          wifi_pass: string | null
          wifi_ssid: string | null
          wifi_velocidad: string | null
        }
        Insert: {
          activo?: boolean
          acuerdo_pago?: Database["public"]["Enums"]["acuerdo_pago"] | null
          airbnb_pass?: string | null
          airbnb_user?: string | null
          ambientes?: Database["public"]["Enums"]["ambientes_tipo"] | null
          barrio?: string | null
          camas_king?: number
          camas_queen?: number
          camas_twin?: number
          capacidad?: number | null
          codigo: string
          comision_pct?: number | null
          created_at?: string
          direccion?: string | null
          encargado_nombre?: string | null
          encargado_telefono?: string | null
          estado?: Database["public"]["Enums"]["depto_estado"]
          habitaciones?: number | null
          ical_ultima_sync?: string | null
          ical_url?: string | null
          id?: string
          indicaciones_acceso?: string | null
          indicaciones_archivos?: Json
          nombre_interno: string
          observacion?: string | null
          propietario_id?: string | null
          propietario_telefono?: string | null
          requiere_aviso_seguridad?: boolean
          requiere_registro?: boolean
          self_checkout?: Database["public"]["Enums"]["self_checkout_tipo"]
          sillon_cama?: number
          total_camas?: number | null
          trabajo_verificado?: boolean
          updated_at?: string
          url_mapa?: string | null
          url_publicacion?: string | null
          wifi_pass?: string | null
          wifi_ssid?: string | null
          wifi_velocidad?: string | null
        }
        Update: {
          activo?: boolean
          acuerdo_pago?: Database["public"]["Enums"]["acuerdo_pago"] | null
          airbnb_pass?: string | null
          airbnb_user?: string | null
          ambientes?: Database["public"]["Enums"]["ambientes_tipo"] | null
          barrio?: string | null
          camas_king?: number
          camas_queen?: number
          camas_twin?: number
          capacidad?: number | null
          codigo?: string
          comision_pct?: number | null
          created_at?: string
          direccion?: string | null
          encargado_nombre?: string | null
          encargado_telefono?: string | null
          estado?: Database["public"]["Enums"]["depto_estado"]
          habitaciones?: number | null
          ical_ultima_sync?: string | null
          ical_url?: string | null
          id?: string
          indicaciones_acceso?: string | null
          indicaciones_archivos?: Json
          nombre_interno?: string
          observacion?: string | null
          propietario_id?: string | null
          propietario_telefono?: string | null
          requiere_aviso_seguridad?: boolean
          requiere_registro?: boolean
          self_checkout?: Database["public"]["Enums"]["self_checkout_tipo"]
          sillon_cama?: number
          total_camas?: number | null
          trabajo_verificado?: boolean
          updated_at?: string
          url_mapa?: string | null
          url_publicacion?: string | null
          wifi_pass?: string | null
          wifi_ssid?: string | null
          wifi_velocidad?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "propietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      distribucion_depto: {
        Row: {
          activo: boolean
          created_at: string
          depto_id: string
          id: string
          notas: string | null
          persona_id: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          depto_id: string
          id?: string
          notas?: string | null
          persona_id?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          depto_id?: string
          id?: string
          notas?: string | null
          persona_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribucion_depto_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribucion_depto_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      equipamiento_bebe: {
        Row: {
          activo: boolean
          creado_por: string | null
          created_at: string
          depto_id: string | null
          estado: Database["public"]["Enums"]["equipamiento_estado"]
          fecha_desde: string
          fecha_hasta: string
          id: string
          notas: string | null
          reserva_id: string | null
          tipo: Database["public"]["Enums"]["equipamiento_tipo"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          depto_id?: string | null
          estado?: Database["public"]["Enums"]["equipamiento_estado"]
          fecha_desde: string
          fecha_hasta: string
          id?: string
          notas?: string | null
          reserva_id?: string | null
          tipo: Database["public"]["Enums"]["equipamiento_tipo"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          depto_id?: string | null
          estado?: Database["public"]["Enums"]["equipamiento_estado"]
          fecha_desde?: string
          fecha_hasta?: string
          id?: string
          notas?: string | null
          reserva_id?: string | null
          tipo?: Database["public"]["Enums"]["equipamiento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipamiento_bebe_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipamiento_bebe_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_estadia: {
        Row: {
          acceso_dejado: boolean
          created_at: string
          estado: Database["public"]["Enums"]["evento_estado"]
          fecha_coordinada: string | null
          hora_coordinada: string | null
          id: string
          late_checkout: boolean
          observaciones: string | null
          punto_acceso_id: string | null
          punto_devolucion_id: string | null
          reserva_id: string
          responsable_devolucion_id: string | null
          responsable_id: string | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at: string
        }
        Insert: {
          acceso_dejado?: boolean
          created_at?: string
          estado?: Database["public"]["Enums"]["evento_estado"]
          fecha_coordinada?: string | null
          hora_coordinada?: string | null
          id?: string
          late_checkout?: boolean
          observaciones?: string | null
          punto_acceso_id?: string | null
          punto_devolucion_id?: string | null
          reserva_id: string
          responsable_devolucion_id?: string | null
          responsable_id?: string | null
          tipo: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
        }
        Update: {
          acceso_dejado?: boolean
          created_at?: string
          estado?: Database["public"]["Enums"]["evento_estado"]
          fecha_coordinada?: string | null
          hora_coordinada?: string | null
          id?: string
          late_checkout?: boolean
          observaciones?: string | null
          punto_acceso_id?: string | null
          punto_devolucion_id?: string | null
          reserva_id?: string
          responsable_devolucion_id?: string | null
          responsable_id?: string | null
          tipo?: Database["public"]["Enums"]["evento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventos_estadia_punto_acceso_id_fkey"
            columns: ["punto_acceso_id"]
            isOneToOne: false
            referencedRelation: "puntos_acceso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_estadia_punto_devolucion_id_fkey"
            columns: ["punto_devolucion_id"]
            isOneToOne: false
            referencedRelation: "puntos_acceso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_estadia_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_estadia_responsable_devolucion_id_fkey"
            columns: ["responsable_devolucion_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventos_estadia_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          created_at: string
          descripcion: string | null
          fecha: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          fecha: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          fecha?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      importaciones: {
        Row: {
          actualizadas: number | null
          anomalias: Json
          archivos: Json
          canceladas_detectadas: number | null
          created_at: string
          descartadas_reaparecidas: number | null
          filas_total: number | null
          id: string
          nuevas: number | null
          sin_asignar: number | null
          sin_cambios: number | null
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          actualizadas?: number | null
          anomalias?: Json
          archivos?: Json
          canceladas_detectadas?: number | null
          created_at?: string
          descartadas_reaparecidas?: number | null
          filas_total?: number | null
          id?: string
          nuevas?: number | null
          sin_asignar?: number | null
          sin_cambios?: number | null
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          actualizadas?: number | null
          anomalias?: Json
          archivos?: Json
          canceladas_detectadas?: number | null
          created_at?: string
          descartadas_reaparecidas?: number | null
          filas_total?: number | null
          id?: string
          nuevas?: number | null
          sin_asignar?: number | null
          sin_cambios?: number | null
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      importaciones_economico: {
        Row: {
          archivos: number
          avisos: Json
          cerrado_en: string | null
          created_at: string
          cuentas_nuevas: number
          estado: Database["public"]["Enums"]["economico_estado_lote"]
          filas_duplicadas: number
          filas_leidas: number
          filas_nuevas: number
          filas_sin_mapear: number
          id: string
          tipo: Database["public"]["Enums"]["economico_tipo_carga"]
          updated_at: string
          usuario_id: string | null
        }
        Insert: {
          archivos?: number
          avisos?: Json
          cerrado_en?: string | null
          created_at?: string
          cuentas_nuevas?: number
          estado?: Database["public"]["Enums"]["economico_estado_lote"]
          filas_duplicadas?: number
          filas_leidas?: number
          filas_nuevas?: number
          filas_sin_mapear?: number
          id?: string
          tipo: Database["public"]["Enums"]["economico_tipo_carga"]
          updated_at?: string
          usuario_id?: string | null
        }
        Update: {
          archivos?: number
          avisos?: Json
          cerrado_en?: string | null
          created_at?: string
          cuentas_nuevas?: number
          estado?: Database["public"]["Enums"]["economico_estado_lote"]
          filas_duplicadas?: number
          filas_leidas?: number
          filas_nuevas?: number
          filas_sin_mapear?: number
          id?: string
          tipo?: Database["public"]["Enums"]["economico_tipo_carga"]
          updated_at?: string
          usuario_id?: string | null
        }
        Relationships: []
      }
      inventario_depto: {
        Row: {
          created_at: string
          depto_id: string
          detalle: string | null
          id: string
          item_id: string
          tiene: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          depto_id: string
          detalle?: string | null
          id?: string
          item_id: string
          tiene?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          depto_id?: string
          detalle?: string | null
          id?: string
          item_id?: string
          tiene?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventario_depto_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventario_depto_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      item_catalogo: {
        Row: {
          activo: boolean
          categoria: string | null
          created_at: string
          id: string
          nombre: string
          orden: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nombre: string
          orden?: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          categoria?: string | null
          created_at?: string
          id?: string
          nombre?: string
          orden?: number
          updated_at?: string
        }
        Relationships: []
      }
      limpieza_checklist: {
        Row: {
          created_at: string
          hecho: boolean
          id: string
          item: string
          limpieza_id: string
          seccion: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hecho?: boolean
          id?: string
          item: string
          limpieza_id: string
          seccion: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hecho?: boolean
          id?: string
          item?: string
          limpieza_id?: string
          seccion?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_checklist_limpieza_id_fkey"
            columns: ["limpieza_id"]
            isOneToOne: false
            referencedRelation: "limpiezas"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_faltantes: {
        Row: {
          cantidad: number | null
          created_at: string
          id: string
          item_id: string | null
          limpieza_id: string
          notas: string | null
          updated_at: string
        }
        Insert: {
          cantidad?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          limpieza_id: string
          notas?: string | null
          updated_at?: string
        }
        Update: {
          cantidad?: number | null
          created_at?: string
          id?: string
          item_id?: string | null
          limpieza_id?: string
          notas?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_faltantes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "item_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpieza_faltantes_limpieza_id_fkey"
            columns: ["limpieza_id"]
            isOneToOne: false
            referencedRelation: "limpiezas"
            referencedColumns: ["id"]
          },
        ]
      }
      limpieza_fotos: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          limpieza_id: string
          storage_path: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          limpieza_id: string
          storage_path: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          limpieza_id?: string
          storage_path?: string
          tipo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "limpieza_fotos_limpieza_id_fkey"
            columns: ["limpieza_id"]
            isOneToOne: false
            referencedRelation: "limpiezas"
            referencedColumns: ["id"]
          },
        ]
      }
      limpiezas: {
        Row: {
          asignado_a: string | null
          created_at: string
          depto_id: string
          estado: Database["public"]["Enums"]["limpieza_estado"]
          fecha: string
          hora_checkout: string | null
          hora_fin: string | null
          hora_inicio: string | null
          id: string
          moneda: string | null
          monto_pactado: number | null
          notas: string | null
          pago_doble: boolean
          prox_checkin: string | null
          reserva_id: string | null
          rol_reserva: Database["public"]["Enums"]["rol_reserva_tipo"] | null
          tarifa_id: string | null
          tipo: Database["public"]["Enums"]["limpieza_tipo"]
          updated_at: string
          urgente: boolean
          viatico_aprobado: boolean | null
          viatico_comprobante: string | null
          viatico_monto: number | null
        }
        Insert: {
          asignado_a?: string | null
          created_at?: string
          depto_id: string
          estado?: Database["public"]["Enums"]["limpieza_estado"]
          fecha: string
          hora_checkout?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          moneda?: string | null
          monto_pactado?: number | null
          notas?: string | null
          pago_doble?: boolean
          prox_checkin?: string | null
          reserva_id?: string | null
          rol_reserva?: Database["public"]["Enums"]["rol_reserva_tipo"] | null
          tarifa_id?: string | null
          tipo?: Database["public"]["Enums"]["limpieza_tipo"]
          updated_at?: string
          urgente?: boolean
          viatico_aprobado?: boolean | null
          viatico_comprobante?: string | null
          viatico_monto?: number | null
        }
        Update: {
          asignado_a?: string | null
          created_at?: string
          depto_id?: string
          estado?: Database["public"]["Enums"]["limpieza_estado"]
          fecha?: string
          hora_checkout?: string | null
          hora_fin?: string | null
          hora_inicio?: string | null
          id?: string
          moneda?: string | null
          monto_pactado?: number | null
          notas?: string | null
          pago_doble?: boolean
          prox_checkin?: string | null
          reserva_id?: string | null
          rol_reserva?: Database["public"]["Enums"]["rol_reserva_tipo"] | null
          tarifa_id?: string | null
          tipo?: Database["public"]["Enums"]["limpieza_tipo"]
          updated_at?: string
          urgente?: boolean
          viatico_aprobado?: boolean | null
          viatico_comprobante?: string | null
          viatico_monto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "limpiezas_asignado_a_fkey"
            columns: ["asignado_a"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpiezas_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpiezas_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "limpiezas_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidacion_lineas: {
        Row: {
          concepto: string
          created_at: string
          id: string
          liquidacion_id: string
          moneda: string | null
          monto: number | null
          movimiento_id: string | null
          reserva_id: string | null
          updated_at: string
        }
        Insert: {
          concepto: string
          created_at?: string
          id?: string
          liquidacion_id: string
          moneda?: string | null
          monto?: number | null
          movimiento_id?: string | null
          reserva_id?: string | null
          updated_at?: string
        }
        Update: {
          concepto?: string
          created_at?: string
          id?: string
          liquidacion_id?: string
          moneda?: string | null
          monto?: number | null
          movimiento_id?: string | null
          reserva_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidacion_lineas_gasto_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidacion_lineas_liquidacion_id_fkey"
            columns: ["liquidacion_id"]
            isOneToOne: false
            referencedRelation: "liquidaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidacion_lineas_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidaciones: {
        Row: {
          created_at: string
          estado: string | null
          id: string
          periodo_desde: string
          periodo_hasta: string
          propietario_id: string
          total_moneda: string | null
          total_monto: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: string | null
          id?: string
          periodo_desde: string
          periodo_hasta: string
          propietario_id: string
          total_moneda?: string | null
          total_monto?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: string | null
          id?: string
          periodo_desde?: string
          periodo_hasta?: string
          propietario_id?: string
          total_moneda?: string | null
          total_monto?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidaciones_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "propietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_alias: {
        Row: {
          activo: boolean
          canal: Database["public"]["Enums"]["canal_tipo"]
          created_at: string
          depto_id: string
          id: string
          nombre_listing: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          canal: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          depto_id: string
          id?: string
          nombre_listing: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          canal?: Database["public"]["Enums"]["canal_tipo"]
          created_at?: string
          depto_id?: string
          id?: string
          nombre_listing?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_alias_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_cobertura: {
        Row: {
          created_at: string
          id: string
          monto: number
          movimiento_id: string
          origen_id: string | null
          tc: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          monto: number
          movimiento_id: string
          origen_id?: string | null
          tc?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          monto?: number
          movimiento_id?: string
          origen_id?: string | null
          tc?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_cobertura_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_caja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimiento_cobertura_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "movimientos_caja"
            referencedColumns: ["id"]
          },
        ]
      }
      movimiento_comprobantes: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          movimiento_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          movimiento_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          movimiento_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimiento_comprobantes_movimiento_id_fkey"
            columns: ["movimiento_id"]
            isOneToOne: false
            referencedRelation: "movimientos_caja"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_acceso: {
        Row: {
          confirmado: boolean
          created_at: string
          depto_id: string
          evento_id: string
          id: string
          persona_id: string | null
          punto_acceso_id: string
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          updated_at: string
        }
        Insert: {
          confirmado?: boolean
          created_at?: string
          depto_id: string
          evento_id: string
          id?: string
          persona_id?: string | null
          punto_acceso_id: string
          tipo: Database["public"]["Enums"]["movimiento_tipo"]
          updated_at?: string
        }
        Update: {
          confirmado?: boolean
          created_at?: string
          depto_id?: string
          evento_id?: string
          id?: string
          persona_id?: string | null
          punto_acceso_id?: string
          tipo?: Database["public"]["Enums"]["movimiento_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_acceso_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_acceso_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_estadia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_acceso_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_acceso_punto_acceso_id_fkey"
            columns: ["punto_acceso_id"]
            isOneToOne: false
            referencedRelation: "puntos_acceso"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_caja: {
        Row: {
          activo: boolean
          categoria_id: string | null
          created_at: string
          depto_id: string | null
          descripcion: string | null
          fecha: string
          fecha_cobro: string | null
          fecha_tc: string | null
          forma_cobro: string | null
          id: string
          moneda: string | null
          monto: number
          notas_cobro: string | null
          reembolsable: boolean
          ref_externa: string | null
          tc: number | null
          tc_cambio: number | null
          tipo: Database["public"]["Enums"]["caja_tipo"]
          updated_at: string
          usd_cambiado: number | null
        }
        Insert: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          depto_id?: string | null
          descripcion?: string | null
          fecha: string
          fecha_cobro?: string | null
          fecha_tc?: string | null
          forma_cobro?: string | null
          id?: string
          moneda?: string | null
          monto: number
          notas_cobro?: string | null
          reembolsable?: boolean
          ref_externa?: string | null
          tc?: number | null
          tc_cambio?: number | null
          tipo?: Database["public"]["Enums"]["caja_tipo"]
          updated_at?: string
          usd_cambiado?: number | null
        }
        Update: {
          activo?: boolean
          categoria_id?: string | null
          created_at?: string
          depto_id?: string | null
          descripcion?: string | null
          fecha?: string
          fecha_cobro?: string | null
          fecha_tc?: string | null
          forma_cobro?: string | null
          id?: string
          moneda?: string | null
          monto?: number
          notas_cobro?: string | null
          reembolsable?: boolean
          ref_externa?: string | null
          tc?: number | null
          tc_cambio?: number | null
          tipo?: Database["public"]["Enums"]["caja_tipo"]
          updated_at?: string
          usd_cambiado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_movimiento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_economicos: {
        Row: {
          activo: boolean
          aircover_destino: Database["public"]["Enums"]["aircover_destino"]
          anuncio: string | null
          archivo: string
          calculado_en: string | null
          categoria: Database["public"]["Enums"]["economico_categoria"]
          cobrado: number | null
          codigo_confirmacion: string | null
          comision_pct_aplicada: number | null
          created_at: string
          cuenta_id: string | null
          depto_id: string | null
          detalles: string | null
          es_custodia: boolean | null
          es_payout: boolean
          fecha: string
          fecha_fin: string | null
          fecha_inicio: string | null
          fecha_reserva: string | null
          ganancia_usd: number | null
          grupo_con_coanfitrion: boolean
          grupo_payout: number | null
          huella: string
          huesped: string | null
          id: string
          import_id: string
          importe: number | null
          ingresos_brutos: number | null
          linea: number
          moneda: string
          monto: number | null
          noches: number | null
          ocurrencia: number
          orden_en_archivo: number
          percibido_usd: number | null
          propietario_id: string | null
          prorrateada: boolean
          raw: Json
          tarifa_limpieza: number | null
          tc_deducido: boolean
          tc_usd: number | null
          tipo_raw: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          aircover_destino?: Database["public"]["Enums"]["aircover_destino"]
          anuncio?: string | null
          archivo: string
          calculado_en?: string | null
          categoria: Database["public"]["Enums"]["economico_categoria"]
          cobrado?: number | null
          codigo_confirmacion?: string | null
          comision_pct_aplicada?: number | null
          created_at?: string
          cuenta_id?: string | null
          depto_id?: string | null
          detalles?: string | null
          es_custodia?: boolean | null
          es_payout?: boolean
          fecha: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_reserva?: string | null
          ganancia_usd?: number | null
          grupo_con_coanfitrion?: boolean
          grupo_payout?: number | null
          huella: string
          huesped?: string | null
          id?: string
          import_id: string
          importe?: number | null
          ingresos_brutos?: number | null
          linea: number
          moneda: string
          monto?: number | null
          noches?: number | null
          ocurrencia?: number
          orden_en_archivo: number
          percibido_usd?: number | null
          propietario_id?: string | null
          prorrateada?: boolean
          raw: Json
          tarifa_limpieza?: number | null
          tc_deducido?: boolean
          tc_usd?: number | null
          tipo_raw: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          aircover_destino?: Database["public"]["Enums"]["aircover_destino"]
          anuncio?: string | null
          archivo?: string
          calculado_en?: string | null
          categoria?: Database["public"]["Enums"]["economico_categoria"]
          cobrado?: number | null
          codigo_confirmacion?: string | null
          comision_pct_aplicada?: number | null
          created_at?: string
          cuenta_id?: string | null
          depto_id?: string | null
          detalles?: string | null
          es_custodia?: boolean | null
          es_payout?: boolean
          fecha?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          fecha_reserva?: string | null
          ganancia_usd?: number | null
          grupo_con_coanfitrion?: boolean
          grupo_payout?: number | null
          huella?: string
          huesped?: string | null
          id?: string
          import_id?: string
          importe?: number | null
          ingresos_brutos?: number | null
          linea?: number
          moneda?: string
          monto?: number | null
          noches?: number | null
          ocurrencia?: number
          orden_en_archivo?: number
          percibido_usd?: number | null
          propietario_id?: string | null
          prorrateada?: boolean
          raw?: Json
          tarifa_limpieza?: number | null
          tc_deducido?: boolean
          tc_usd?: number | null
          tipo_raw?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_economicos_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas_payout"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_economicos_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_economicos_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "importaciones_economico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_economicos_propietario_id_fkey"
            columns: ["propietario_id"]
            isOneToOne: false
            referencedRelation: "propietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_reporte: {
        Row: {
          activo: boolean
          creado_por: string | null
          created_at: string
          depto_id: string | null
          detalle: string | null
          estado: Database["public"]["Enums"]["reporte_estado"]
          fecha: string | null
          fecha_hasta: string | null
          hecho_at: string | null
          hecho_por: string | null
          id: string
          responsable_id: string | null
          seccion: Database["public"]["Enums"]["reporte_seccion"]
          titulo: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          depto_id?: string | null
          detalle?: string | null
          estado?: Database["public"]["Enums"]["reporte_estado"]
          fecha?: string | null
          fecha_hasta?: string | null
          hecho_at?: string | null
          hecho_por?: string | null
          id?: string
          responsable_id?: string | null
          seccion: Database["public"]["Enums"]["reporte_seccion"]
          titulo: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          creado_por?: string | null
          created_at?: string
          depto_id?: string | null
          detalle?: string | null
          estado?: Database["public"]["Enums"]["reporte_estado"]
          fecha?: string | null
          fecha_hasta?: string | null
          hecho_at?: string | null
          hecho_por?: string | null
          id?: string
          responsable_id?: string | null
          seccion?: Database["public"]["Enums"]["reporte_seccion"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_reporte_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_reporte_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_personal: {
        Row: {
          created_at: string
          fecha_pago: string | null
          id: string
          moneda: string | null
          monto: number | null
          notas: string | null
          periodo_desde: string
          periodo_hasta: string
          persona_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fecha_pago?: string | null
          id?: string
          moneda?: string | null
          monto?: number | null
          notas?: string | null
          periodo_desde: string
          periodo_hasta: string
          persona_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fecha_pago?: string | null
          id?: string
          moneda?: string | null
          monto?: number | null
          notas?: string | null
          periodo_desde?: string
          periodo_hasta?: string
          persona_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pagos_personal_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "personas"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_operativos: {
        Row: {
          clave: string
          created_at: string
          descripcion: string | null
          id: string
          updated_at: string
          valor: string
        }
        Insert: {
          clave: string
          created_at?: string
          descripcion?: string | null
          id?: string
          updated_at?: string
          valor: string
        }
        Update: {
          clave?: string
          created_at?: string
          descripcion?: string | null
          id?: string
          updated_at?: string
          valor?: string
        }
        Relationships: []
      }
      personas: {
        Row: {
          activo: boolean
          created_at: string
          es_backoffice: boolean
          hace_checkin: boolean
          hace_limpieza: boolean
          id: string
          modalidad_pago: Database["public"]["Enums"]["modalidad_pago"] | null
          nombre: string
          profile_id: string | null
          rol: Database["public"]["Enums"]["rol_usuario"] | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          es_backoffice?: boolean
          hace_checkin?: boolean
          hace_limpieza?: boolean
          id?: string
          modalidad_pago?: Database["public"]["Enums"]["modalidad_pago"] | null
          nombre: string
          profile_id?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          es_backoffice?: boolean
          hace_checkin?: boolean
          hace_limpieza?: boolean
          id?: string
          modalidad_pago?: Database["public"]["Enums"]["modalidad_pago"] | null
          nombre?: string
          profile_id?: string | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prestadores: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          notas: string | null
          rubro: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          notas?: string | null
          rubro?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          notas?: string | null
          rubro?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      propietarios: {
        Row: {
          activo: boolean
          contacto: string | null
          created_at: string
          cuenta_cobro: string | null
          datos_bancarios: string | null
          fecha_nacimiento: string | null
          id: string
          nombre: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          cuenta_cobro?: string | null
          datos_bancarios?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contacto?: string | null
          created_at?: string
          cuenta_cobro?: string | null
          datos_bancarios?: string | null
          fecha_nacimiento?: string | null
          id?: string
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      puntajes_calidad: {
        Row: {
          codigo_reserva: string
          comentario: string | null
          created_at: string
          fecha: string | null
          id: string
          import_id: string | null
          puntaje: number
          updated_at: string
        }
        Insert: {
          codigo_reserva: string
          comentario?: string | null
          created_at?: string
          fecha?: string | null
          id?: string
          import_id?: string | null
          puntaje: number
          updated_at?: string
        }
        Update: {
          codigo_reserva?: string
          comentario?: string | null
          created_at?: string
          fecha?: string | null
          id?: string
          import_id?: string | null
          puntaje?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "puntajes_calidad_codigo_reserva_fkey"
            columns: ["codigo_reserva"]
            isOneToOne: false
            referencedRelation: "reservas"
            referencedColumns: ["codigo_reserva"]
          },
          {
            foreignKeyName: "puntajes_calidad_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      puntos_acceso: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          identificador: string | null
          instrucciones: string | null
          metodo: Database["public"]["Enums"]["metodo_acceso"]
          orden: number
          sirve_checkin: boolean
          sirve_checkout: boolean
          ubicacion: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          identificador?: string | null
          instrucciones?: string | null
          metodo: Database["public"]["Enums"]["metodo_acceso"]
          orden?: number
          sirve_checkin?: boolean
          sirve_checkout?: boolean
          ubicacion?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          identificador?: string | null
          instrucciones?: string | null
          metodo?: Database["public"]["Enums"]["metodo_acceso"]
          orden?: number
          sirve_checkin?: boolean
          sirve_checkout?: boolean
          ubicacion?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reclamo_fotos: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          orden: number
          origen: Database["public"]["Enums"]["reclamo_foto_origen"]
          reclamo_id: string
          storage_path: string
          tomada_at: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          orden?: number
          origen?: Database["public"]["Enums"]["reclamo_foto_origen"]
          reclamo_id: string
          storage_path: string
          tomada_at?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          orden?: number
          origen?: Database["public"]["Enums"]["reclamo_foto_origen"]
          reclamo_id?: string
          storage_path?: string
          tomada_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reclamo_fotos_reclamo_id_fkey"
            columns: ["reclamo_id"]
            isOneToOne: false
            referencedRelation: "reclamos"
            referencedColumns: ["id"]
          },
        ]
      }
      reclamos: {
        Row: {
          activo: boolean
          categoria: Database["public"]["Enums"]["reclamo_categoria"]
          creado_por: string | null
          created_at: string
          escalado_at: string | null
          estado: Database["public"]["Enums"]["reclamo_estado"]
          id: string
          moneda: string
          monto_cobrado: number | null
          monto_reclamado: number | null
          motivo: string | null
          nota_interna: string | null
          presentado_at: string | null
          reserva_id: string
          resuelto_at: string | null
          updated_at: string
          url_airbnb: string | null
        }
        Insert: {
          activo?: boolean
          categoria?: Database["public"]["Enums"]["reclamo_categoria"]
          creado_por?: string | null
          created_at?: string
          escalado_at?: string | null
          estado?: Database["public"]["Enums"]["reclamo_estado"]
          id?: string
          moneda?: string
          monto_cobrado?: number | null
          monto_reclamado?: number | null
          motivo?: string | null
          nota_interna?: string | null
          presentado_at?: string | null
          reserva_id: string
          resuelto_at?: string | null
          updated_at?: string
          url_airbnb?: string | null
        }
        Update: {
          activo?: boolean
          categoria?: Database["public"]["Enums"]["reclamo_categoria"]
          creado_por?: string | null
          created_at?: string
          escalado_at?: string | null
          estado?: Database["public"]["Enums"]["reclamo_estado"]
          id?: string
          moneda?: string
          monto_cobrado?: number | null
          monto_reclamado?: number | null
          motivo?: string | null
          nota_interna?: string | null
          presentado_at?: string | null
          reserva_id?: string
          resuelto_at?: string | null
          updated_at?: string
          url_airbnb?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reclamos_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: true
            referencedRelation: "reservas"
            referencedColumns: ["id"]
          },
        ]
      }
      reservas: {
        Row: {
          adultos: number | null
          aviso_seguridad_hecho: boolean
          bebes: number | null
          canal: Database["public"]["Enums"]["canal_tipo"]
          cancelada: boolean
          codigo_reserva: string
          created_at: string
          datos_completos: boolean
          depto_id: string | null
          descartada: boolean
          fecha_checkin: string | null
          fecha_checkout: string | null
          fecha_checkout_real: string | null
          fecha_reservada: string | null
          huesped_contacto: string | null
          huesped_nombre: string | null
          id: string
          import_id: string | null
          listing_nombre_raw: string | null
          llegada_desde:
            | Database["public"]["Enums"]["llegada_desde_tipo"]
            | null
          ninos: number | null
          noches: number | null
          origen: Database["public"]["Enums"]["origen_reserva"]
          payout_moneda: string | null
          payout_monto: number | null
          raw: Json | null
          registro_hecho: boolean
          sobre_ok: boolean
          updated_at: string
        }
        Insert: {
          adultos?: number | null
          aviso_seguridad_hecho?: boolean
          bebes?: number | null
          canal?: Database["public"]["Enums"]["canal_tipo"]
          cancelada?: boolean
          codigo_reserva: string
          created_at?: string
          datos_completos?: boolean
          depto_id?: string | null
          descartada?: boolean
          fecha_checkin?: string | null
          fecha_checkout?: string | null
          fecha_checkout_real?: string | null
          fecha_reservada?: string | null
          huesped_contacto?: string | null
          huesped_nombre?: string | null
          id?: string
          import_id?: string | null
          listing_nombre_raw?: string | null
          llegada_desde?:
            | Database["public"]["Enums"]["llegada_desde_tipo"]
            | null
          ninos?: number | null
          noches?: number | null
          origen: Database["public"]["Enums"]["origen_reserva"]
          payout_moneda?: string | null
          payout_monto?: number | null
          raw?: Json | null
          registro_hecho?: boolean
          sobre_ok?: boolean
          updated_at?: string
        }
        Update: {
          adultos?: number | null
          aviso_seguridad_hecho?: boolean
          bebes?: number | null
          canal?: Database["public"]["Enums"]["canal_tipo"]
          cancelada?: boolean
          codigo_reserva?: string
          created_at?: string
          datos_completos?: boolean
          depto_id?: string | null
          descartada?: boolean
          fecha_checkin?: string | null
          fecha_checkout?: string | null
          fecha_checkout_real?: string | null
          fecha_reservada?: string | null
          huesped_contacto?: string | null
          huesped_nombre?: string | null
          id?: string
          import_id?: string | null
          listing_nombre_raw?: string | null
          llegada_desde?:
            | Database["public"]["Enums"]["llegada_desde_tipo"]
            | null
          ninos?: number | null
          noches?: number | null
          origen?: Database["public"]["Enums"]["origen_reserva"]
          payout_moneda?: string | null
          payout_monto?: number | null
          raw?: Json | null
          registro_hecho?: boolean
          sobre_ok?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "importaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas: {
        Row: {
          ambientes: Database["public"]["Enums"]["ambientes_tipo"] | null
          created_at: string
          depto_id: string | null
          id: string
          moneda: string
          monto: number
          updated_at: string
          vigente_desde: string
          vigente_hasta: string | null
        }
        Insert: {
          ambientes?: Database["public"]["Enums"]["ambientes_tipo"] | null
          created_at?: string
          depto_id?: string | null
          id?: string
          moneda: string
          monto: number
          updated_at?: string
          vigente_desde: string
          vigente_hasta?: string | null
        }
        Update: {
          ambientes?: Database["public"]["Enums"]["ambientes_tipo"] | null
          created_at?: string
          depto_id?: string | null
          id?: string
          moneda?: string
          monto?: number
          updated_at?: string
          vigente_desde?: string
          vigente_hasta?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_depto_id_fkey"
            columns: ["depto_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      puede_escribir_reporte: { Args: never; Returns: boolean }
      puede_gestionar_reclamos: { Args: never; Returns: boolean }
      puede_ver_caja: { Args: never; Returns: boolean }
      puede_ver_economico: { Args: never; Returns: boolean }
      saldo_caja: { Args: { p_hasta?: string }; Returns: number }
      saldo_caja_antes: { Args: { p_fecha: string }; Returns: number }
    }
    Enums: {
      acuerdo_pago: "cobra_todo_mth" | "cobra_cada_uno" | "solo_comision"
      aircover_destino: "sin_asignar" | "mthosting" | "propietario"
      ambientes_tipo: "monoambiente" | "dos" | "tres" | "cuatro"
      bloqueo_motivo: "mantenimiento" | "uso_propietario" | "vacio" | "otro"
      caja_tipo: "ingreso" | "egreso"
      canal_tipo: "airbnb" | "booking" | "directa"
      cuenta_clasificacion: "mth" | "propietario" | "sin_clasificar"
      depto_estado: "activo" | "suspendido"
      economico_categoria:
        | "reserva"
        | "coanfitrion"
        | "payout"
        | "resolucion"
        | "ajuste"
        | "ajuste_resolucion"
        | "tarifa_cancelacion"
        | "reembolso_tarifa_cancelacion"
        | "aircover"
        | "otro"
      economico_estado_lote: "vigente" | "deshecho"
      economico_tipo_carga: "efectivo" | "programado"
      equipamiento_estado: "pedido" | "entregado" | "retirado"
      equipamiento_tipo: "cuna" | "silla" | "banadera"
      evento_estado: "pendiente" | "coordinado" | "hecho" | "cancelado"
      evento_tipo: "checkin" | "checkout"
      limpieza_estado:
        | "pendiente"
        | "asignada"
        | "en_curso"
        | "hecha"
        | "verificada"
        | "cancelada"
      limpieza_tipo:
        | "inicial"
        | "profunda"
        | "repaso"
        | "normal"
        | "cambio_blancos"
        | "con_huespedes"
        | "desmantelar"
        | "propietario"
      llegada_desde_tipo: "depto" | "eze" | "aep" | "bqb"
      metodo_acceso:
        | "presencial"
        | "candado"
        | "sobre"
        | "valijas"
        | "self"
        | "llaves"
      modalidad_pago: "por_limpieza" | "sueldo_mensual" | "ambas"
      movimiento_tipo: "dejada" | "retirada"
      origen_reserva: "csv" | "ical" | "manual"
      reclamo_categoria:
        | "mobiliario"
        | "electrodomestico"
        | "limpieza_extraordinaria"
        | "faltante"
        | "edilicio"
        | "huespedes_no_declarados"
        | "otro"
      reclamo_estado:
        | "borrador"
        | "por_presentar"
        | "presentado"
        | "escalado"
        | "cobrado"
        | "rechazado"
        | "descartado"
      reclamo_foto_origen: "limpieza" | "manual"
      reporte_estado: "pendiente" | "hecho"
      reporte_seccion: "anuncio" | "pendiente"
      rol_reserva_tipo: "salida" | "entrada" | "durante"
      rol_usuario:
        | "admin"
        | "manager"
        | "gobernanta"
        | "coordinador"
        | "limpieza"
        | "propietario"
      self_checkout_tipo: "siempre" | "solo_multiples" | "no"
      tipo_bano: "completo_banera" | "completo_ducha" | "toilette"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acuerdo_pago: ["cobra_todo_mth", "cobra_cada_uno", "solo_comision"],
      aircover_destino: ["sin_asignar", "mthosting", "propietario"],
      ambientes_tipo: ["monoambiente", "dos", "tres", "cuatro"],
      bloqueo_motivo: ["mantenimiento", "uso_propietario", "vacio", "otro"],
      caja_tipo: ["ingreso", "egreso"],
      canal_tipo: ["airbnb", "booking", "directa"],
      cuenta_clasificacion: ["mth", "propietario", "sin_clasificar"],
      depto_estado: ["activo", "suspendido"],
      economico_categoria: [
        "reserva",
        "coanfitrion",
        "payout",
        "resolucion",
        "ajuste",
        "ajuste_resolucion",
        "tarifa_cancelacion",
        "reembolso_tarifa_cancelacion",
        "aircover",
        "otro",
      ],
      economico_estado_lote: ["vigente", "deshecho"],
      economico_tipo_carga: ["efectivo", "programado"],
      equipamiento_estado: ["pedido", "entregado", "retirado"],
      equipamiento_tipo: ["cuna", "silla", "banadera"],
      evento_estado: ["pendiente", "coordinado", "hecho", "cancelado"],
      evento_tipo: ["checkin", "checkout"],
      limpieza_estado: [
        "pendiente",
        "asignada",
        "en_curso",
        "hecha",
        "verificada",
        "cancelada",
      ],
      limpieza_tipo: [
        "inicial",
        "profunda",
        "repaso",
        "normal",
        "cambio_blancos",
        "con_huespedes",
        "desmantelar",
        "propietario",
      ],
      llegada_desde_tipo: ["depto", "eze", "aep", "bqb"],
      metodo_acceso: [
        "presencial",
        "candado",
        "sobre",
        "valijas",
        "self",
        "llaves",
      ],
      modalidad_pago: ["por_limpieza", "sueldo_mensual", "ambas"],
      movimiento_tipo: ["dejada", "retirada"],
      origen_reserva: ["csv", "ical", "manual"],
      reclamo_categoria: [
        "mobiliario",
        "electrodomestico",
        "limpieza_extraordinaria",
        "faltante",
        "edilicio",
        "huespedes_no_declarados",
        "otro",
      ],
      reclamo_estado: [
        "borrador",
        "por_presentar",
        "presentado",
        "escalado",
        "cobrado",
        "rechazado",
        "descartado",
      ],
      reclamo_foto_origen: ["limpieza", "manual"],
      reporte_estado: ["pendiente", "hecho"],
      reporte_seccion: ["anuncio", "pendiente"],
      rol_reserva_tipo: ["salida", "entrada", "durante"],
      rol_usuario: [
        "admin",
        "manager",
        "gobernanta",
        "coordinador",
        "limpieza",
        "propietario",
      ],
      self_checkout_tipo: ["siempre", "solo_multiples", "no"],
      tipo_bano: ["completo_banera", "completo_ducha", "toilette"],
    },
  },
} as const
