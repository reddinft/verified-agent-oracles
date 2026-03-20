export const PRICE_USDC = 0.001;
export const NETWORK = "solana-devnet";
export const TOKEN = "USDC";
export const RESEARCHER = "Archie";
export const SPECIALIST = "Ogma";
export const TREASURY = "3Vmcwra5tfxGwaX3jnpmYybCd7gH4fstJzi1Yci38f94";

export function paymentRequest(topic) {
  return {
    kind: "x402",
    amount: PRICE_USDC,
    token: TOKEN,
    network: NETWORK,
    payTo: TREASURY,
    resource: `/insights/${topic}`,
  };
}
