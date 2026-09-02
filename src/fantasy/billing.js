// Membresía "sin anuncios" via Stripe Checkout (suscripción) + Customer
// Portal (para que el usuario cancele/gestione desde Stripe, sin tener que
// construir esa parte a mano). Ver .env.example para las claves que hacen
// falta y como crearlas.
const store = require('./store');

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Falta STRIPE_SECRET_KEY. Copia .env.example a .env y añade tu clave secreta de Stripe.');
  }
  const Stripe = require('stripe');
  return new Stripe(key);
}

function getPriceId() {
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error('Falta STRIPE_PRICE_ID. Crea un precio recurrente en el Dashboard de Stripe y pega su ID en .env.');
  }
  return priceId;
}

function siteUrl() {
  return process.env.SITE_URL || 'http://localhost:3000';
}

async function createCheckoutSession(user) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: getPriceId(), quantity: 1 }],
    client_reference_id: user.id,
    customer: user.stripeCustomerId || undefined,
    success_url: `${siteUrl()}/membership.html?checkout=success`,
    cancel_url: `${siteUrl()}/membership.html?checkout=cancel`
  });
  return session.url;
}

async function createPortalSession(user) {
  if (!user.stripeCustomerId) {
    throw new Error('Todavía no tienes una suscripción activa.');
  }
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${siteUrl()}/membership.html`
  });
  return session.url;
}

function attachStripeCustomer(userId, customerId) {
  const users = store.getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return;
  user.stripeCustomerId = customerId;
  store.saveUsers(users);
}

function setPremiumByCustomerId(customerId, isPremium, subscriptionId) {
  const users = store.getUsers();
  const user = users.find((u) => u.stripeCustomerId === customerId);
  if (!user) return;
  user.isPremium = isPremium;
  user.stripeSubscriptionId = subscriptionId || null;
  store.saveUsers(users);
}

// Stripe manda el estado de la suscripción por webhook, no lo consultamos
// nosotros: checkout.session.completed marca al usuario como premium en
// cuanto paga, y customer.subscription.updated/deleted lo mantienen al día
// (renovación, cancelación, impago...).
async function handleWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('Falta STRIPE_WEBHOOK_SECRET.');
  const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.client_reference_id && session.customer) {
        attachStripeCustomer(session.client_reference_id, session.customer);
        setPremiumByCustomerId(session.customer, true, session.subscription);
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      setPremiumByCustomerId(sub.customer, ['active', 'trialing'].includes(sub.status), sub.id);
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object;
      setPremiumByCustomerId(sub.customer, false, null);
      break;
    }
  }
  return event;
}

module.exports = { createCheckoutSession, createPortalSession, handleWebhookEvent };
