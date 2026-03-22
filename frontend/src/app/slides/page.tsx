"use client";

import { useEffect } from "react";

const SLIDES_CONTENT = `
## 🕷️ Verified Agent Oracles
### TEE-Attested AI Judgment as a Payment Primitive
**Anansi × Ogma | MagicBlock PER | Solana Devnet**

---

## The Problem

Agents can't pay other agents for work without:

- **Trusted execution** — who verifies the scorer didn't cheat?
- **On-chain proof** — how does the escrow know the score is real?
- **Atomic settlement** — payment must be conditional, not hopeful

---

## The Solution

> What if the scoring itself happened inside a **hardware-attested enclave**?

And the proof was committed to Solana **before** payment released?

---

## The Loop

1. 🕷️ **Anansi** generates a culturally-rich Caribbean folk story
2. 🔒 **Anansi** locks 0.001 SOL in escrow | threshold ≥ 7
3. 🛡️ **Ogma** scores inside MagicBlock **TEE (Private Ephemeral Rollup)**
4. 📜 Score + attestation committed to **Solana L1**
5. 💰 Escrow releases SOL → Ogma if score ≥ threshold

---

## TEE = Trust Without Trusting Ogma

- **Intel TDX hardware** isolates execution
- Ogma's score is computed inside the enclave
- The enclave signs the result — **cryptographic attestation**
- Committed to Solana L1 via MagicBlock's Private Ephemeral Rollup
- Escrow program verifies the attestation before releasing funds

**Neither Anansi nor anyone else can tamper with the score**

---

## Devnet Proof — Live Transactions

| Step | Transaction |
|------|------------|
| 1. Escrow Init | 5qwXqLPk... |
| 2. Score Init | 4rb1NV1Y... |
| 3. TEE Delegate | 57bCCNcK... |
| 4. Submit Score 🛡️ | MVcFep3k... |
| 5. Undelegate + Finalize | K2iWtKz1... |
| 6. Release Payment | 3hmKTQeB... |

**Program:** GyT8wyGD3dG3sVQ986SGwKxF23iWNjdbSe4oCuBrkMdd (Solana Devnet)

View full signatures: [github.com/nissan/verified-agent-oracles](https://github.com/nissan/verified-agent-oracles)

---

## Why This Matters

### Today
- AI agents evaluate creative work (stories, code, designs)
- Payment depends on the evaluation
- Who trusts the evaluator?

### With Verified Agent Oracles
- **Evaluation is hardware-attested**
- **Proof is on-chain before money moves**
- **Fully composable** — any agent can be an oracle

---

## Primitives Unlocked

- 🎨 **Creative bounties** — pay artists when quality threshold met
- 🤖 **Agent hiring markets** — task completion verified by oracle
- 📊 **Reputation systems** — scores backed by cryptographic proof
- 🏆 **Hackathons on-chain** — judging that can't be gamed

---

## What We Built Tonight

- ✅ Anchor program: escrow + TEE score verification
- ✅ MagicBlock PER integration (delegation + commit)
- ✅ TypeScript client: full end-to-end pipeline
- ✅ **6 devnet transactions** — real proof on Solana
- ✅ This demo site 🎉

---

## Stack

- **Solana** — L1 settlement + escrow program
- **MagicBlock** — Private Ephemeral Rollup (TEE)
- **Anchor** — program framework
- **Next.js + Tailwind** — this demo
- **Anansi** (story) + **Ogma** (scorer) — AI agent pair

---

## 🕷️ Thank You

**Verified Agent Oracles**
*TEE-attested AI judgment as a payment primitive*

Built at **MagicBlock Solana Blitz v2**

[github.com/nissan/verified-agent-oracles](https://github.com/nissan/verified-agent-oracles)
`;

const DIAGRAM_SLIDES = [
  {
    src: "/diagrams/diagram-1.svg",
    alt: "System Overview",
    title: "System Overview",
  },
  {
    src: "/diagrams/diagram-2.svg",
    alt: "Transaction Sequence",
    title: "Transaction Sequence",
  },
  {
    src: "/diagrams/diagram-3.svg",
    alt: "Permission Flow",
    title: "Permission Flow",
  },
  {
    src: "/diagrams/diagram-4.svg",
    alt: "Payment Gate",
    title: "Payment Gate",
  },
  {
    src: "/diagrams/diagram-5.svg",
    alt: "Agent Economy Vision",
    title: "Agent Economy Vision",
  },
];

// Insert diagram slides after "The Loop" section (index 3)
const DIAGRAM_INSERT_AFTER = 3;

export default function Slides() {
  useEffect(() => {
    // Initialize Reveal after scripts load
    const init = () => {
      // @ts-expect-error - Reveal is loaded via CDN
      if (typeof window.Reveal !== "undefined") {
        // @ts-expect-error - Reveal is loaded via CDN
        window.Reveal.initialize({
          hash: true,
          slideNumber: true,
          transition: "slide",
          backgroundTransition: "fade",
          width: 1920,
          height: 1080,
          margin: 0.02,
          minScale: 0.1,
          maxScale: 2.0,
          plugins: [
            // @ts-expect-error - Reveal plugins loaded via CDN
            window.RevealMarkdown,
            // @ts-expect-error - Reveal plugins loaded via CDN
            window.RevealHighlight,
          ],
        });
      }
    };

    // Load reveal.js scripts
    const loadScript = (src: string): Promise<void> =>
      new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
      });

    const loadLink = (href: string) => {
      const existing = document.querySelector(`link[href="${href}"]`);
      if (existing) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    };

    // Load Reveal.js CSS
    loadLink("https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css");
    loadLink(
      "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/night.css"
    );
    loadLink(
      "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/monokai.css"
    );

    // Load scripts in order
    loadScript(
      "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"
    )
      .then(() =>
        loadScript(
          "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/markdown/markdown.js"
        )
      )
      .then(() =>
        loadScript(
          "https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/plugin/highlight/highlight.js"
        )
      )
      .then(() => {
        setTimeout(init, 100);
      })
      .catch(console.error);
  }, []);

  // Convert markdown sections to slides
  const sections = SLIDES_CONTENT.trim()
    .split(/\n---\n/)
    .map((s) => s.trim());

  const beforeDiagrams = sections.slice(0, DIAGRAM_INSERT_AFTER + 1);
  const afterDiagrams = sections.slice(DIAGRAM_INSERT_AFTER + 1);

  return (
    <>
      <style>{`
        html, body, #__next {
          height: 100%;
          margin: 0;
          padding: 0;
          background: #0d1117 !important;
          color: #ffffff !important;
        }
        .reveal {
          background: #0d1117 !important;
          color: #ffffff !important;
        }
        .reveal .slides {
          text-align: left;
          color: #ffffff !important;
        }
        .reveal .slides section {
          background: transparent !important;
          color: #ffffff !important;
        }
        .reveal .slides section h1,
        .reveal .slides section h2,
        .reveal .slides section h3,
        .reveal .slides section h4,
        .reveal .slides section p,
        .reveal .slides section li,
        .reveal .slides section span,
        .reveal .slides section td,
        .reveal .slides section th,
        .reveal .slides section blockquote {
          color: #ffffff !important;
        }
        .reveal h1, .reveal h2, .reveal h3, .reveal h4 {
          text-transform: none;
          color: #ffffff !important;
        }
        .reveal strong {
          color: #c084fc !important;
        }
        .reveal pre code {
          font-size: 0.7em;
          line-height: 1.4;
        }
        .reveal table {
          font-size: 0.8em;
        }
        .reveal table th,
        .reveal table td {
          color: #ffffff !important;
        }
        .reveal section img {
          max-width: 95% !important;
          max-height: 85vh !important;
          width: auto !important;
          height: auto !important;
          object-fit: contain !important;
          border: none !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        .diagram-slide {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          height: 100% !important;
        }
        .diagram-slide img {
          width: 95vw !important;
          max-height: 85vh !important;
          object-fit: contain !important;
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
        }
        .back-link {
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 9999;
          background: rgba(0,0,0,0.6);
          color: #9945FF;
          border: 1px solid #9945FF44;
          padding: 6px 14px;
          border-radius: 8px;
          text-decoration: none;
          font-family: monospace;
          font-size: 12px;
        }
        .back-link:hover {
          background: rgba(153, 69, 255, 0.2);
          color: #c084fc;
        }
      `}</style>

      <a href="/" className="back-link">
        ← Demo
      </a>

      <div className="reveal" style={{ height: "100vh", width: "100vw", background: "#0d1117", color: "#ffffff" }}>
        <div className="slides">
          {/* Slides before diagram section */}
          {beforeDiagrams.map((section, i) => (
            <section key={`pre-${i}`} data-markdown="">
              <textarea
                data-template=""
                defaultValue={section}
                style={{ display: "none" }}
              />
            </section>
          ))}

          {/* Full-screen Architecture diagram slides */}
          {DIAGRAM_SLIDES.map((diagram, i) => (
            <section key={`diagram-${i}`} data-background-color="#0d1117" className="diagram-slide">
              <h3 style={{ color: "#9945FF", fontSize: "1.2rem", marginBottom: "0.5rem", textAlign: "center" }}>
                {diagram.title}
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={diagram.src}
                alt={diagram.alt}
                style={{
                  width: "95vw",
                  maxHeight: "85vh",
                  objectFit: "contain",
                  background: "transparent",
                  border: "none",
                  boxShadow: "none",
                }}
              />
            </section>
          ))}

          {/* Remaining slides */}
          {afterDiagrams.map((section, i) => (
            <section key={`post-${i}`} data-markdown="">
              <textarea
                data-template=""
                defaultValue={section}
                style={{ display: "none" }}
              />
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
