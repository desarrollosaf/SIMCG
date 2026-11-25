'use strict';

// Un solo libro (acta) por tipo de movimiento y año. La tabla vieja no tenía
// índice único; si ya hay repetidos hay que limpiarlos a mano antes de migrar.
const INDICE = 'libros_tipo_movimiento_anio_unique';

module.exports = {
  async up(queryInterface) {
    const [repetidos] = await queryInterface.sequelize.query(
      `SELECT tipo_movimiento_id, anio, COUNT(*) AS veces,
              GROUP_CONCAT(id ORDER BY id) AS ids
         FROM libros
        GROUP BY tipo_movimiento_id, anio
       HAVING COUNT(*) > 1`,
    );
    if (repetidos.length > 0) {
      const detalle = repetidos
        .map(
          (r) =>
            `tipo_movimiento_id=${r.tipo_movimiento_id}, anio=${r.anio} (ids ${r.ids})`,
        )
        .join('; ');
      throw new Error(
        `No se puede crear el índice único ${INDICE}: hay libros repetidos. ` +
          `Deja uno por tipo y año y vuelve a migrar. Repetidos: ${detalle}`,
      );
    }
    await queryInterface.addIndex('libros', ['tipo_movimiento_id', 'anio'], {
      name: INDICE,
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('libros', INDICE);
  },
};
