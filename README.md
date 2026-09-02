# NBA Fantasy

Fantasy de la NBA: cada usuario ficha jugadores reales con un presupuesto
inicial, compite en una liga cerrada de hasta 10 usuarios, y el precio de
cada jugador (y el dinero que gana su dueño) se ajusta solo según su
rendimiento partido a partido.

## Reglas del juego

- **Presupuesto inicial**: $160.000.000 por usuario para formar plantilla al
  entrar en una liga (máximo 15 jugadores).
- **Precio de cada jugador**: se calcula a partir de su valoración NBA 2K.
  Ej. 65 de valoración ≈ $2M, 79 ≈ $20M, 91 ≈ $40M (interpolado para el
  resto de valoraciones — ver `src/fantasy/pricing.js`).
- **El precio se ajusta solo tras cada partido**: se calcula la
  "valoración" real del jugador en ese partido (PIR: puntos + rebotes +
  asistencias + robos + tapones, menos tiros fallados y pérdidas) y se
  compara con lo esperado para su valoración 2K. Por encima de lo esperado
  sube el precio, por debajo lo baja (tope de ±15% por partido para que un
  solo partido no dispare el mercado).
- **Dinero por partido**: cada usuario gana $10.000 por cada punto de
  valoración conseguido por los jugadores de su plantilla (ej. 30 de
  valoración → $300.000), reutilizable para fichar más jugadores.
- **Ligas de hasta 10 usuarios**: se crean con un nombre y generan un
  código de invitación de 6 caracteres para que se unan el resto. Dentro de
  una misma liga, un jugador solo puede estar fichado por un usuario a la
  vez; se puede vender en cualquier momento al precio de mercado actual
  para recuperar liquidez y fichar a otro.
- **Clasificación**: cada liga se ordena por la valoración total acumulada
  por la plantilla de cada usuario a lo largo de la temporada (no por
  dinero), que es a fin de cuentas a quién compite el juego.

## 1. Configurar las claves de las APIs

Copia `.env.example` a `.env` y rellena:

```bash
cp .env.example .env
```

- **`BALLDONTLIE_API_KEY`**: gratis en https://www.balldontlie.io (botón
  "Sign up" / "My Account"). Trae los equipos, plantillas y partidos.
  **El ajuste automático de precios y el reparto de dinero por partido
  necesitan además el endpoint `/stats` (box score partido a partido), que
  requiere el plan de pago ALL-STAR o superior (~$9.99/mes)**. Sin ese
  plan, el juego funciona igual para fichar/vender jugadores con su precio
  inicial (fijado por su valoración 2K), pero los precios no se moverán
  solos ni se repartirá dinero hasta tener ese plan.
- **`NBA2KAPI_KEY`**: gratis en https://www.nba2kapi.com ("Get an API
  key"). Da las valoraciones NBA 2K que fijan el precio inicial de cada
  jugador.

## 2. Instalar dependencias

```bash
npm install
```

## 3. Arrancar el servidor

```bash
npm start
```

Abre http://localhost:3000

En el primer arranque, si no hay datos cacheados en `data/`, el servidor
descarga automáticamente equipos, plantillas, partidos de la temporada
actual y valoraciones 2K (puede tardar varios minutos por el límite de
peticiones por minuto de las APIs gratuitas).

## 4. Actualización automática

Mientras el proceso `npm start` esté corriendo, tres tareas programadas
(`node-cron`) mantienen todo al día:

- **06:00 cada día**: refresca equipos, plantillas y partidos de la
  temporada actual.
- **Domingos 07:00**: refresca las valoraciones NBA 2K (cambian poco).
- **Cada 2 horas**: procesa los partidos recién terminados — ajusta
  precios y reparte dinero a quien tenga fichado a cada jugador.

Para forzar un refresco manual sin esperar al cron:

```bash
npm run refresh              # equipos + plantillas + partidos
node src/refreshAll.js ratings2k
node src/refreshAll.js games
npm run fantasy:process       # procesar partidos ya terminados a mano
```

## 5. Desplegar en un servicio real

App Node.js estándar (Express): puedes desplegarla en Render, Railway, un
VPS con PM2, etc.

- Configura `BALLDONTLIE_API_KEY` y `NBA2KAPI_KEY` en el panel del
  hosting.
- Si tu hosting permite disco persistente (ej. Render Disks), móntalo y
  añade la variable `DATA_DIR` apuntando a esa ruta. Así la caché de
  `data/*.json` (usuarios, ligas, plantillas, precios...) sobrevive a los
  redeploys en vez de perderse cada vez.
- El proceso debe quedarse corriendo de forma continua (no serverless
  "one-shot") para que los cron internos se ejecuten.

## Estructura

```
server.js                     Servidor Express y montaje de /api/fantasy
src/balldontlie.js            Cliente de balldontlie.io (equipos/plantillas/partidos/stats)
src/ratings2k.js               Cliente de nba2kapi.com (valoraciones NBA 2K)
src/cache.js                   Lectura/escritura de la caché en data/*.json
src/refreshAll.js              Refresco de equipos/plantillas/partidos/valoraciones
src/scheduler.js               Tareas cron internas
src/fantasy/store.js           Lectura/escritura de la caché del modo Fantasy
src/fantasy/auth.js            Registro/login y sesiones por token
src/fantasy/groups.js          Ligas (crear/unirse por código, hasta 10 usuarios)
src/fantasy/roster.js          Fichar/vender jugadores dentro de una liga
src/fantasy/market.js          Lista de jugadores con su precio actual
src/fantasy/pricing.js         Fórmulas de precio, valoración y dinero por partido
src/fantasy/gameProcessor.js   Procesa partidos terminados: ajusta precios y reparte dinero
src/fantasy/routes.js          Rutas /api/fantasy/*
public/index.html              Login/registro y gestión de ligas
public/group.html              Mercado / mi plantilla / clasificación de una liga
public/                        Frontend (HTML/CSS/JS vanilla)
```
