# SIMCG

Sistema de Servidores Públicos (Angular + NestJS + MariaDB).

## Levantar con Docker

```bash
# crear .env en la raíz con DB_DUMPS_DIR y MARIADB_ROOT_PASSWORD
cp backend/.env.example backend/.env
# editar ambos .env (ver variables abajo)
docker compose up
```

- Frontend: http://localhost:4220
- Backend: http://localhost:3065/api/health
- Base de datos (MariaDB): localhost:3310
- Adminer: http://localhost:8090 (servidor `db`, usuario `root`, contraseña `MARIADB_ROOT_PASSWORD`)

En el primer arranque el servicio `db` crea las bases `cddiputados` y `declaranet` y carga los
respaldos `dump-cddiputados-*.sql` y `dump-declaranet-*.sql` que estén en `DB_DUMPS_DIR`.
Para recargarlos hay que borrar el volumen: `docker compose down -v`.

Producción: `docker compose -f docker-compose.prod.yml up -d --build` (`BASE_HREF` configurable).

## Variables

`.env` (raíz): `DB_DUMPS_DIR` (carpeta con los respaldos), `MARIADB_ROOT_PASSWORD`.

`backend/.env`: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`,
`DB_DECLARANET_*` (HOST, PORT, USERNAME, PASSWORD, DATABASE), `JWT_SECRET`,
`JWT_EXPIRES_IN_SECONDS`, `MAIL_*` (HOST, PORT, USER, PASSWORD, FROM) y `DECLARANET_*`
(API_URL, CLIENT_ID, CLIENT_SECRET, USERNAME, PASSWORD).

## Pruebas

```bash
# frontend (vitest + jsdom)
docker run --rm -v "$PWD:/app" -v simcg_frontend_node_modules:/app/node_modules -w /app node:26-alpine npm test -- --no-watch

# backend (jest: unitarias y e2e)
docker run --rm -v "$PWD/backend:/app" -v simcg_backend_node_modules:/app/node_modules -w /app node:26-alpine sh -c "npm test && npm run test:e2e"
```

Las pruebas usan mocks: no tocan la base de datos.
