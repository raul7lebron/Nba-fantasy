// Motor de precios del modo Fantasy.
//
// El precio de cada jugador se fija a partir de su valoración NBA 2K
// mediante una tabla de anclas interpoladas linealmente. Los tres puntos de
// referencia (65 -> 2M, 79 -> 20M, 91 -> 40M) son los que pidió el usuario;
// el resto de anclas rellenan una curva razonable alrededor de ellos, desde
// un jugador de banquillo (60) hasta una superestrella histórica (99).
const PRICE_ANCHORS = [
  { rating: 60, price: 250_000 },
  { rating: 65, price: 2_000_000 },
  { rating: 70, price: 5_000_000 },
  { rating: 75, price: 10_000_000 },
  { rating: 79, price: 20_000_000 },
  { rating: 85, price: 30_000_000 },
  { rating: 91, price: 40_000_000 },
  { rating: 95, price: 55_000_000 },
  { rating: 99, price: 75_000_000 }
];

// Valoración (índice de puntos, ver computeValoracionFromBoxScore) media
// esperada por partido según la valoración 2K del jugador. Sirve de línea
// base para saber si un partido concreto fue mejor o peor de lo esperado y
// mover el precio en consecuencia.
const EXPECTED_VALORACION_ANCHORS = [
  { rating: 60, valoracion: 4 },
  { rating: 65, valoracion: 8 },
  { rating: 70, valoracion: 12 },
  { rating: 75, valoracion: 16 },
  { rating: 79, valoracion: 19 },
  { rating: 85, valoracion: 24 },
  { rating: 91, valoracion: 29 },
  { rating: 95, valoracion: 33 },
  { rating: 99, valoracion: 38 }
];

function interpolate(anchors, x) {
  if (x <= anchors[0].rating) return anchors[0];
  const last = anchors[anchors.length - 1];
  if (x >= last.rating) return last;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (x >= a.rating && x <= b.rating) return { a, b, t: (x - a.rating) / (b.rating - a.rating) };
  }
  return last;
}

function basePriceForRating(rating) {
  const r = rating == null ? 60 : rating;
  const hit = interpolate(PRICE_ANCHORS, r);
  const price = hit.price != null ? hit.price : hit.a.price + hit.t * (hit.b.price - hit.a.price);
  return Math.round(price / 10_000) * 10_000;
}

function expectedValoracionForRating(rating) {
  const r = rating == null ? 60 : rating;
  const hit = interpolate(EXPECTED_VALORACION_ANCHORS, r);
  return hit.valoracion != null ? hit.valoracion : hit.a.valoracion + hit.t * (hit.b.valoracion - hit.a.valoracion);
}

// Misma fórmula de "valoración" (PIR) que ya usa el resto de la web (ver
// computeValoracion en public/js/playerModal.js), aplicada partido a
// partido en vez de a la media de temporada: puntos + rebotes + asistencias
// + robos + tapones, menos tiros de campo y libres fallados y pérdidas.
function computeValoracionFromBoxScore(stat) {
  const missedFg = (stat.fga ?? 0) - (stat.fgm ?? 0);
  const missedFt = (stat.fta ?? 0) - (stat.ftm ?? 0);
  return (
    (stat.pts ?? 0) + (stat.reb ?? 0) + (stat.ast ?? 0) + (stat.stl ?? 0) + (stat.blk ?? 0) -
    missedFg - missedFt - (stat.turnover ?? 0)
  );
}

const MAX_PRICE_CHANGE_PER_GAME = 0.15; // tope de +-15% de movimiento por partido
const MIN_PRICE_FACTOR = 0.4; // nunca por debajo del 40% del precio base
const MAX_PRICE_FACTOR = 3; // nunca por encima del 300% del precio base

// Ajusta el precio actual según si la valoración del partido estuvo por
// encima o por debajo de lo esperado para la valoración 2K del jugador: un
// partidazo lo sube, un partido flojo lo baja. El movimiento está acotado
// para que un único partido no dispare el mercado, y el precio siempre se
// mantiene dentro de una banda razonable alrededor de su precio base.
function adjustPrice(currentPrice, basePrice, rating, valoracion) {
  const expected = expectedValoracionForRating(rating);
  const diffRatio = expected > 0 ? (valoracion - expected) / expected : 0;
  const changePct = Math.max(-1, Math.min(1, diffRatio)) * MAX_PRICE_CHANGE_PER_GAME;
  const uncapped = currentPrice * (1 + changePct);
  const floor = basePrice * MIN_PRICE_FACTOR;
  const ceil = basePrice * MAX_PRICE_FACTOR;
  return Math.round(Math.max(floor, Math.min(ceil, uncapped)) / 10_000) * 10_000;
}

// Dinero que gana cada usuario por partido según la valoración conseguida
// por cada jugador de su plantilla (ej. 30 de valoración -> $300.000). Un
// partido malo (valoración negativa) no resta dinero, simplemente no da nada.
function moneyForValoracion(valoracion) {
  return Math.max(0, Math.round(valoracion)) * 10_000;
}

module.exports = {
  PRICE_ANCHORS,
  basePriceForRating,
  expectedValoracionForRating,
  computeValoracionFromBoxScore,
  adjustPrice,
  moneyForValoracion
};
