'use strict';

// activity_log.properties era varchar(191): no alcanza para guardar el motivo y la
// lista de cambios (antes → después) de una edición. TEXT es compatible con lo que
// ya escribe y lee el sistema viejo (JSON como texto).
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('activity_log', 'properties', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('activity_log', 'properties', {
      type: Sequelize.STRING(191),
      allowNull: true,
    });
  },
};
