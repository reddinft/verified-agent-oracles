import { PRICE_USDC, RESEARCHER, SPECIALIST } from "./config.mjs";
import { settle } from "./ledger.mjs";

export function payForInsight(topic, payment) {
  if (payment.kind !== "x402") {
    throw new Error("unsupported payment request");
  }
  const memo = `research-dag:${topic}`;
  return settle(RESEARCHER, SPECIALIST, PRICE_USDC, memo);
}
