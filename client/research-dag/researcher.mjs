import { requestInsight } from "./specialist.mjs";
import { payForInsight } from "./payment.mjs";

export function runResearchLoop(topic) {
  const first = requestInsight(topic);
  if (first.status !== 402) {
    throw new Error("expected x402 challenge");
  }
  const receipt = payForInsight(topic, first.payment);
  const second = requestInsight(topic, receipt.id);
  return {
    topic,
    payment: receipt,
    result: second.data,
    summary: `Researcher paid Specialist for ${topic} and cached the insight.`,
  };
}
