#!/bin/bash
# Se ejecuta una sola vez, cuando el volumen de datos está vacío.
# Crea las bases cddiputados y declaranet y carga cada dump desde /respaldos (solo lectura).
set -e

cargar() {
  local base="$1"
  local patron="$2"
  local archivo
  archivo=$(ls -1 /respaldos/${patron} 2>/dev/null | sort | tail -n 1 || true)

  echo "Creando base ${base}"
  mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" \
    -e "CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

  if [ -z "${archivo}" ]; then
    echo "AVISO: no hay respaldo ${patron} en /respaldos; ${base} queda vacía."
    return 0
  fi

  echo "Cargando ${archivo} en ${base}"
  mariadb -uroot -p"${MARIADB_ROOT_PASSWORD}" --default-character-set=utf8mb4 "${base}" < "${archivo}"
}

cargar cddiputados 'dump-cddiputados-*.sql'
cargar declaranet 'dump-declaranet-*.sql'
