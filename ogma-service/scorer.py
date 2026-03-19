"""
Ogma Cultural Scoring Service
Scores Anansi's stories for cultural appropriateness (1-10)
Returns score + story_hash (SHA-256 of story text) for on-chain TEE attestation

Venice AI integration: OpenAI-compatible endpoint, zero data retention.
Model: mistral-small-3-2-24b-instruct (fast, cheap, Private-tier, structured JSON)
Fallback: venice-uncensored (confirmed supportsResponseSchema: true)

Env vars required:
  VENICE_API_KEY  — from Venice dashboard (https://venice.ai)
"""

import hashlib
import json
import os
import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Venice AI — OpenAI-compatible, zero data retention
# Drop-in: just change base_url from api.openai.com → api.venice.ai/api/v1
try:
    from openai import AsyncOpenAI
    _venice_client = None  # lazy-init to avoid import-time env errors

    def get_venice_client() -> AsyncOpenAI:
        global _venice_client
        if _venice_client is None:
            api_key = os.environ.get("VENICE_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "VENICE_API_KEY env var not set. "
                    "Get your key at https://venice.ai and set VENICE_API_KEY."
                )
            _venice_client = AsyncOpenAI(
                api_key=api_key,
                base_url="https://api.venice.ai/api/v1",
            )
        return _venice_client

    VENICE_AVAILABLE = True
except ImportError:
    VENICE_AVAILABLE = False


app = FastAPI(title="Ogma Scorer", description="TEE-attested cultural appropriateness scoring")

# Venice model choice — both are Privacy: Private (zero retention, decentralised infra)
# mistral-small-3-2-24b-instruct: cheapest capable model ($0.09/$0.25 per 1M tokens)
# venice-uncensored: confirmed supportsResponseSchema, good fallback
VENICE_MODEL = os.environ.get("VENICE_MODEL", "mistral-small-3-2-24b-instruct")

OGMA_SYSTEM_PROMPT = """You are Ogma, guardian of cultural integrity and linguistic truth.
You score stories for cultural appropriateness on a scale of 1-10.

Consider:
- Accurate and respectful representation of cultures, traditions, and peoples
- Absence of harmful stereotypes or caricatures
- Authentic voice — not appropriative or exploitative
- Sensitivity to historical context and power dynamics

Respond ONLY with valid JSON in this exact format:
{"score": <integer 1-10>, "rationale": "<one or two sentences explaining the score>"}

Do not include any other text, explanation, or formatting outside the JSON."""


class ScoreRequest(BaseModel):
    story: str
    story_id: str | None = None


class ScoreResponse(BaseModel):
    score: int                    # 1-10 cultural appropriateness rating
    story_hash: str               # SHA-256 hex of story text — proof of which story was scored
    story_hash_bytes: list[int]   # Raw bytes for on-chain submission (32 bytes)
    scored_at: int                # Unix timestamp
    story_id: str | None
    rationale: str                # Brief reasoning — visible but execution was shielded in TEE
    model_used: str               # Which Venice model scored this


def compute_story_hash(story_text: str) -> tuple[str, list[int]]:
    """SHA-256 of story text. This hash is committed on-chain alongside the score."""
    h = hashlib.sha256(story_text.encode("utf-8")).digest()
    return h.hex(), list(h)


async def score_story_with_venice(story: str) -> tuple[int, str, str]:
    """
    Call Venice AI to score cultural appropriateness.
    Returns (score: int, rationale: str, model_used: str)

    This call happens INSIDE the TEE — Venice sees the story, but the
    result is attested before being written on-chain. Venice's zero-retention
    architecture means no prompt/response is stored server-side.

    Venice API reference: research/venice-api-reference.md
    Pattern adapted from celo-agent-demo ogma validation service.
    """
    if not VENICE_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="openai package not installed. Run: pip install openai"
        )

    client = get_venice_client()

    response = await client.chat.completions.create(
        model=VENICE_MODEL,
        messages=[
            {"role": "system", "content": OGMA_SYSTEM_PROMPT},
            {"role": "user", "content": f"Score this story for cultural appropriateness:\n\n{story}"},
        ],
        temperature=0.1,   # Low temp for consistent scoring
        max_tokens=200,
        # Venice extension: disable Venice's default system prompt injection
        # so only our Ogma prompt is used
        extra_body={"venice_parameters": {"include_venice_system_prompt": False}},
    )

    raw = response.choices[0].message.content.strip()

    # Parse JSON response
    try:
        result = json.loads(raw)
        score = int(result["score"])
        rationale = str(result["rationale"])
        if not (1 <= score <= 10):
            raise ValueError(f"Score {score} out of range 1-10")
    except (json.JSONDecodeError, KeyError, ValueError) as e:
        raise HTTPException(
            status_code=502,
            detail=f"Venice returned malformed JSON: {raw!r} — error: {e}"
        )

    return score, rationale, VENICE_MODEL


@app.post("/score", response_model=ScoreResponse)
async def score(request: ScoreRequest):
    """
    Score a story for cultural appropriateness.
    Returns score + story_hash for on-chain TEE attestation proof.

    The story_hash binds the score to this exact story text —
    you cannot swap in a different story after the fact.

    Venice AI is called with zero data retention — nothing is stored
    server-side. The scoring result is TEE-attested before on-chain write.
    """
    if not request.story or len(request.story) < 10:
        raise HTTPException(status_code=400, detail="Story too short")

    story_hash_hex, story_hash_bytes = compute_story_hash(request.story)

    score_val, rationale, model_used = await score_story_with_venice(request.story)

    return ScoreResponse(
        score=score_val,
        story_hash=story_hash_hex,
        story_hash_bytes=story_hash_bytes,
        scored_at=int(time.time()),
        story_id=request.story_id,
        rationale=rationale,
        model_used=model_used,
    )


@app.get("/health")
async def health():
    """Health check — also confirms VENICE_API_KEY is present."""
    has_key = bool(os.environ.get("VENICE_API_KEY"))
    return {
        "status": "ok",
        "service": "ogma-scorer",
        "venice_key_present": has_key,
        "venice_model": VENICE_MODEL,
        "openai_sdk_available": VENICE_AVAILABLE,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
