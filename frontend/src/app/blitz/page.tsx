"use client";

import { useState } from "react";

interface ScoreResult {
  score: number;
  story_hash: string;
  scored_at: number;
  rationale: string;
  attestation_tx?: string;
  payment_tx?: string;
  attested: boolean;
  model_used?: string;
  score_account?: string;
}

export default function BlitzDemo() {
  const [story, setStory] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<
    "idle" | "generating" | "scoring" | "attesting" | "paying" | "done"
  >("idle");
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const THRESHOLD = 7;

  const runPipeline = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Step 1: Score the story (Ogma — TEE-shielded)
      setStep("scoring");
      const scoreRes = await fetch("/api/blitz/score/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ story }),
      });
      if (!scoreRes.ok) throw new Error("Scoring failed");
      const scored = await scoreRes.json();

      // Step 2: Attest + commit to Solana via MagicBlock PER
      setStep("attesting");
      const attestRes = await fetch("/api/blitz/attest/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: scored.score,
          story_hash_bytes: scored.story_hash_bytes,
        }),
      });
      if (!attestRes.ok) throw new Error("Attestation failed");
      const attested = await attestRes.json();

      // Step 3: Release payment if score >= threshold
      setStep("paying");
      const payRes = await fetch("/api/blitz/release/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score_account: attested.score_account }),
      });
      if (!payRes.ok) throw new Error("Payment release failed");
      const payment = await payRes.json();

      setResult({
        score: scored.score,
        story_hash: scored.story_hash,
        scored_at: scored.scored_at,
        rationale: scored.rationale,
        attestation_tx: attested.attest_tx,
        payment_tx: payment.payment_tx,
        attested: true,
        model_used: scored.model_used,
        score_account: attested.score_account,
      });
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Pipeline failed");
      setStep("idle");
    } finally {
      setLoading(false);
    }
  };

  const stepLabel = {
    idle: "",
    generating: "Anansi generating story...",
    scoring: "Ogma scoring inside TEE...",
    attesting: "Committing attestation to Solana...",
    paying: "Releasing payment...",
    done: "Complete",
  }[step];

  return (
    <main className="min-h-screen bg-gray-950 text-white font-mono p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-purple-400">
            Verified Agent Oracles
          </h1>
          <p className="text-gray-400 mt-2">
            TEE-attested AI judgment as a payment condition on Solana.
            <br />
            Ogma scores inside a{" "}
            <span className="text-purple-300">Private Ephemeral Rollup</span> —
            proof is committed on-chain before payment releases.
          </p>
        </div>

        {/* Story Input */}
        <div className="space-y-3">
          <label className="text-sm text-gray-400 uppercase tracking-wider">
            Submit a story for scoring
          </label>

          {/* What is an Anansi story */}
          <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-4 text-sm text-gray-400 space-y-2">
            <p className="text-gray-300 font-semibold">🕷️ What is an Anansi story?</p>
            <p>
              Anansi is the West African and Caribbean trickster spider — a folk hero who outwits
              gods, kings, and monsters through cleverness. Anansi stories typically feature:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-500 text-xs">
              <li>Anansi (or a surrogate trickster) as the protagonist</li>
              <li>A Caribbean, West African, or diasporic setting</li>
              <li>Cultural folklore elements — spirits, animals, traditional values</li>
              <li>A moral or lesson woven into the narrative</li>
            </ul>
            <p className="text-xs text-gray-600">
              Ogma scores stories <span className="text-purple-400">1–10 for cultural authenticity</span> —
              accurate representation, absence of harmful stereotypes, and respectful voice.
              Payment releases automatically when score ≥ 7.
            </p>
          </div>

          <textarea
            className="w-full h-48 bg-gray-900 border border-gray-700 rounded-lg p-4 text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none resize-none text-sm"
            placeholder={`Example opening:\n\n"In the time before time, when animals still walked and talked as men, Anansi the spider came upon a calabash sealed with wax. The old women of the village warned him away, but Anansi had never met a secret he could leave alone..."`}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            disabled={loading}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">{story.length} chars {story.length < 20 ? "— write at least a sentence" : "✓"}</span>
            <button
              onClick={runPipeline}
              disabled={loading || story.length < 20}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-bold transition-colors"
            >
              {loading ? stepLabel : "Run Pipeline →"}
            </button>
          </div>
        </div>

        {/* Pipeline Steps */}
        {step !== "idle" && (
          <div className="border border-gray-800 rounded-lg p-6 space-y-4">
            <h2 className="text-sm uppercase tracking-wider text-gray-400">
              Pipeline
            </h2>
            {[
              {
                id: "scoring",
                label: "Ogma scores inside TEE PER",
                done: ["attesting", "paying", "done"].includes(step),
              },
              {
                id: "attesting",
                label: "Attestation committed to Solana L1",
                done: ["paying", "done"].includes(step),
              },
              {
                id: "paying",
                label: "Payment released (score ≥ threshold)",
                done: step === "done",
              },
            ].map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    s.done
                      ? "bg-green-400"
                      : step === s.id
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-gray-700"
                  }`}
                />
                <span
                  className={
                    s.done
                      ? "text-green-400"
                      : step === s.id
                      ? "text-yellow-400"
                      : "text-gray-600"
                  }
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="border border-purple-800 rounded-lg p-6 space-y-4 bg-purple-950/30">
            <div className="flex items-center justify-between">
              <h2 className="text-purple-400 font-bold text-lg">
                ✅ Verified Oracle Result
              </h2>
              {result.model_used === "ogma-stub-v1" && (
                <span className="px-2 py-1 bg-yellow-900/40 border border-yellow-600 text-yellow-400 text-xs rounded font-mono">
                  demo mode
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  Score
                </div>
                <div
                  className={`text-4xl font-bold ${
                    result.score >= THRESHOLD
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {result.score}/10
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Threshold: {THRESHOLD} — Payment{" "}
                  {result.score >= THRESHOLD ? "released ✅" : "withheld ❌"}
                </div>
              </div>

              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  TEE Attestation
                </div>
                <div className="text-green-400 font-bold">
                  {result.attested ? "ATTESTED ✅" : "PENDING"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Execution shielded in MagicBlock PER
                </div>
              </div>
            </div>

            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                Story Hash (SHA-256)
              </div>
              <div className="text-xs text-gray-300 font-mono break-all bg-gray-900 p-2 rounded">
                {result.story_hash}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Binds this score to this exact story — tamper-proof
              </div>
            </div>

            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                Ogma&apos;s Rationale
              </div>
              <p className="text-sm text-gray-300">{result.rationale}</p>
            </div>

            {result.attestation_tx && (
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  On-Chain Proof
                </div>
                <a
                  href={`https://explorer.solana.com/tx/${result.attestation_tx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm underline break-all"
                >
                  {result.attestation_tx}
                </a>
              </div>
            )}

            {result.payment_tx && (
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
                  Payment Transaction
                </div>
                <a
                  href={`https://explorer.solana.com/tx/${result.payment_tx}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:text-green-300 text-sm underline break-all"
                >
                  {result.payment_tx}
                </a>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="border border-red-800 rounded-lg p-4 text-red-400">
            ❌ {error}
          </div>
        )}

        {/* Footer */}
        <div className="text-xs text-gray-600 pt-4 border-t border-gray-800">
          Built for MagicBlock Solana Blitz v2 · Private Ephemeral Rollups ·{" "}
          <a
            href="https://github.com/reddinft/verified-agent-oracles"
            className="underline hover:text-gray-400"
          >
            github.com/reddinft/verified-agent-oracles
          </a>
        </div>
      </div>
    </main>
  );
}
