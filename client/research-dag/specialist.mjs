import { PRICE_USDC, SPECIALIST, paymentRequest } from "./config.mjs";
import { buildInsight } from "./insights.mjs";
import { verifyReceipt } from "./ledger.mjs";

export function requestInsight(topic, receiptId) {
  if (!receiptId) {
    return { status: 402, payment: paymentRequest(topic) };
  }
  const paid = verifyReceipt(receiptId, SPECIALIST, PRICE_USDC);
  if (!paid) {
    return { status: 402, error: "invalid receipt", payment: paymentRequest(topic) };
  }
  return {
    status: 200,
    data: buildInsight(topic),
  };
}
