import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Coleccion, Modelo } from '../blade/valores';
import { CATALOGO } from './catalogo';
import type { Arbol, RelacionMeta } from './tipos';

type Fila = Record<string, unknown>;

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/**
 * Carga modelos con sus relaciones por adelantado (eager loading) usando SQL
 * parametrizado, y los entrega como `Modelo`s que se leen igual que en Eloquent.
 * Solo lectura.
 */
@Injectable()
export class CargadorEloquent {
  private readonly tiposColumna = new Map<Sequelize, Map<string, string>>();

  constructor(
    @InjectConnection() private readonly principal: Sequelize,
    @InjectConnection('declaranet') private readonly declaranet: Sequelize,
  ) {}

  /** Una fila por llave primaria (o por varias columnas), con sus relaciones. */
  async buscar(
    clase: string,
    donde: Record<string, string | number>,
    arbol: Arbol,
  ): Promise<Modelo | null> {
    const meta = this.meta(clase);
    const condiciones = Object.keys(donde).map(
      (c) => `\`${this.columna(c)}\` = :${c}`,
    );
    const filas = await this.consultar(
      clase,
      `SELECT * FROM \`${meta.tabla}\` WHERE ${condiciones.join(' AND ')}${this.borrado(clase)} ORDER BY \`${meta.pk}\` LIMIT 1`,
      donde,
    );
    if (filas.length === 0) return null;
    const modelo = new Modelo(clase, filas[0]);
    await this.cargarRelaciones([modelo], arbol);
    return modelo;
  }

  /** Precarga en `modelos` (todos de la misma clase) las relaciones del árbol. */
  async cargarRelaciones(modelos: Modelo[], arbol: Arbol): Promise<void> {
    if (modelos.length === 0) return;
    const clase = modelos[0].clase;
    const meta = this.meta(clase);
    for (const [nombre, subarbol] of Object.entries(arbol)) {
      const rel = meta.relaciones[nombre];
      if (!rel) continue;
      const hijos = await this.cargarRelacion(modelos, rel);
      if (hijos.length > 0) await this.cargarRelaciones(hijos, subarbol);
    }
  }

  private async cargarRelacion(
    padres: Modelo[],
    rel: RelacionMeta,
  ): Promise<Modelo[]> {
    const destino = this.meta(rel.destino);
    const clavePadre = rel.claveLocal;
    const valores = [
      ...new Set(
        padres
          .map((p) => p.atributos[clavePadre])
          .filter((v) => v !== null && v !== undefined),
      ),
    ] as (string | number)[];
    const columnaDestino = rel.claveDestino;
    const unico =
      rel.tipo === 'belongsTo' ||
      rel.tipo === 'hasOne' ||
      rel.tipo === 'morphOne';
    const clave = rel.nombre.toLowerCase();

    let filas: Fila[] = [];
    if (valores.length > 0) {
      const extra =
        rel.tipoColumna && rel.tipoValor
          ? ` AND \`${this.columna(rel.tipoColumna)}\` = :tipoValor`
          : '';
      filas = await this.consultar(
        rel.destino,
        `SELECT * FROM \`${destino.tabla}\` WHERE \`${this.columna(columnaDestino)}\` IN (:valores)${extra}${this.borrado(rel.destino)} ORDER BY \`${destino.pk}\``,
        { valores, tipoValor: rel.tipoValor ?? null },
      );
    }

    const porClave = new Map<string, Modelo[]>();
    const hijos: Modelo[] = [];
    for (const fila of filas) {
      const hijo = new Modelo(rel.destino, fila);
      hijos.push(hijo);
      const k = String(fila[columnaDestino]);
      const lista = porClave.get(k);
      if (lista) lista.push(hijo);
      else porClave.set(k, [hijo]);
    }

    for (const padre of padres) {
      const v = padre.atributos[clavePadre] as
        string | number | null | undefined;
      const encontrados =
        v === null || v === undefined ? [] : (porClave.get(String(v)) ?? []);
      padre.relaciones.set(
        clave,
        unico ? (encontrados[0] ?? null) : Coleccion.from(encontrados),
      );
    }
    return hijos;
  }

  // ------------------------------------------------------------ infraestructura

  private meta(clase: string) {
    const meta = CATALOGO[clase];
    if (!meta) throw new Error(`Modelo sin catálogo: ${clase}`);
    return meta;
  }

  /** Solo identificadores simples: las columnas vienen del catálogo, nunca del usuario. */
  private columna(nombre: string): string {
    if (!/^\w+$/.test(nombre)) throw new Error(`Columna no válida: ${nombre}`);
    return nombre;
  }

  private borrado(clase: string): string {
    return this.meta(clase).soft ? ' AND `deleted_at` IS NULL' : '';
  }

  private conexion(clase: string): Sequelize {
    return this.meta(clase).conexion === 'principal'
      ? this.principal
      : this.declaranet;
  }

  private async consultar(
    clase: string,
    sql: string,
    replacements: Record<string, unknown>,
  ): Promise<Fila[]> {
    const conexion = this.conexion(clase);
    const tipos = await this.tiposDe(conexion);
    const tabla = this.meta(clase).tabla;
    const filas = await conexion.query<Fila>(sql, {
      type: QueryTypes.SELECT,
      replacements: replacements,
    });
    return filas.map((fila) => this.normalizar(fila, tabla, tipos));
  }

  /** PDO devolvía fechas como texto ("Y-m-d" / "Y-m-d H:i:s"): se hace lo mismo. */
  private normalizar(fila: Fila, tabla: string, tipos: Map<string, string>) {
    const salida: Fila = {};
    for (const [col, valor] of Object.entries(fila)) {
      if (valor instanceof Date) {
        const f = `${valor.getUTCFullYear()}-${dosDigitos(valor.getUTCMonth() + 1)}-${dosDigitos(valor.getUTCDate())}`;
        salida[col] =
          tipos.get(`${tabla}.${col}`) === 'date'
            ? f
            : `${f} ${dosDigitos(valor.getUTCHours())}:${dosDigitos(valor.getUTCMinutes())}:${dosDigitos(valor.getUTCSeconds())}`;
      } else {
        salida[col] = valor;
      }
    }
    return salida;
  }

  private async tiposDe(conexion: Sequelize): Promise<Map<string, string>> {
    let tipos = this.tiposColumna.get(conexion);
    if (!tipos) {
      const filas = await conexion.query<{ t: string; c: string; d: string }>(
        'SELECT table_name AS t, column_name AS c, data_type AS d FROM information_schema.columns WHERE table_schema = DATABASE()',
        { type: QueryTypes.SELECT },
      );
      tipos = new Map(filas.map((f) => [`${f.t}.${f.c}`, f.d]));
      this.tiposColumna.set(conexion, tipos);
    }
    return tipos;
  }
}
