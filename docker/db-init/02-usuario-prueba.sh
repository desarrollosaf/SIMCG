#!/bin/sh
# Solo desarrollo: deja al usuario id 1 (Administrador) con credenciales de prueba
# tomadas del .env local (DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD_HASH).
set -e

if [ -z "$DEV_ADMIN_EMAIL" ] || [ -z "$DEV_ADMIN_PASSWORD_HASH" ]; then
  echo "Sin DEV_ADMIN_EMAIL / DEV_ADMIN_PASSWORD_HASH: no se crea usuario de prueba"
  exit 0
fi

mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" cddiputados <<SQL
UPDATE users
   SET email = '$DEV_ADMIN_EMAIL',
       password = '$DEV_ADMIN_PASSWORD_HASH',
       verificacion = 1
 WHERE id = 1;
SQL
echo "Usuario de prueba listo: $DEV_ADMIN_EMAIL"
