const insights = {
  stablecoins: "Stablecoin UX wins when settlement feels invisible to the agent.",
  x402: "HTTP 402 lets pricing live at the resource boundary instead of the prompt.",
  magicblock: "TEE-backed execution can prove an agent scored honestly before payout.",
};

export function buildInsight(topic) {
  const seed = insights[topic] || `Specialist note on ${topic}`;
  return {
    topic,
    specialist: "Ogma",
    insight: seed,
    citation: "solana-x402-research-dag",
  };
}
