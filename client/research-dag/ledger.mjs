const balances = new Map([
  ["Archie", 0.01],
  ["Ogma", 0],
]);
const receipts = new Map();

export function getBalances() {
  return Object.fromEntries(balances);
}

export function settle(from, to, amount, memo) {
  balances.set(from, balances.get(from) - amount);
  balances.set(to, balances.get(to) + amount);
  const id = `sim-${Date.now()}`;
  const receipt = { id, from, to, amount, memo, network: "solana-devnet" };
  receipts.set(id, receipt);
  return receipt;
}

export function verifyReceipt(id, to, amount) {
  const receipt = receipts.get(id);
  return !!receipt && receipt.to === to && receipt.amount === amount;
}
