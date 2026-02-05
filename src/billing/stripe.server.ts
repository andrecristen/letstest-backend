import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("[billing] STRIPE_SECRET_KEY not set. Stripe features will fail.");
}

export const stripe = new Stripe(stripeSecretKey ?? "", {
  apiVersion: "2023-10-16",
});

export const stripeConfig = {
  pricePro: process.env.STRIPE_PRICE_PRO ?? "",
  priceEnterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  successUrl: process.env.STRIPE_SUCCESS_URL ?? "http://localhost:3000/billing/success",
  cancelUrl: process.env.STRIPE_CANCEL_URL ?? "http://localhost:3000/billing",
  portalReturnUrl: process.env.STRIPE_PORTAL_RETURN_URL ?? "http://localhost:3000/billing",
};
