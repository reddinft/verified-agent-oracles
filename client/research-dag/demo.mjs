import { runResearchLoop } from "./researcher.mjs";
import { getBalances } from "./ledger.mjs";

const topic = process.argv[2] || "x402";
const run = runResearchLoop(topic);
const output = {
  topic,
  balances: getBalances(),
  paymentId: run.payment.id,
  paymentMemo: run.payment.memo,
  insight: run.result.insight,
  citation: run.result.citation,
  summary: run.summary,
};

console.log(JSON.stringify(output, null, 2));
