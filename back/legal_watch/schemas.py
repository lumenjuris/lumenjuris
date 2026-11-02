"""Schémas Pydantic du module veille juridique (contrats d'API + sortie LLM)."""
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

HORS_PERIMETRE = "hors_perimetre"


# ── Concepts (taxonomie transmise par backNode) ──────────────────────────────

class ConceptDef(BaseModel):
    concept: str
    label: str
    legalDomain: str
    keywords: List[str] = []


# ── /legal-watch/fetch ───────────────────────────────────────────────────────

class FetchRequest(BaseModel):
    queries: List[str] = Field(min_length=1)
    source: Literal["judilibre", "legifrance"] = "judilibre"
    date_start: Optional[str] = None  # YYYY-MM-DD (fenêtre glissante côté Node)
    date_end: Optional[str] = None
    chamber: str = "soc"  # Judilibre uniquement
    max_decisions: int = Field(default=50, ge=1, le=200)
    conventions: List[Dict[str, str]] = []


class FetchedDecision(BaseModel):
    providerId: str
    title: str
    jurisdiction: Optional[str] = None
    decisionDate: Optional[str] = None
    sourceUrl: str
    rawText: str


class FetchResponse(BaseModel):
    decisions: List[FetchedDecision]
    report: Dict[str, Any]


# ── /legal-watch/enrich ──────────────────────────────────────────────────────

class EnrichItemInput(BaseModel):
    externalId: str
    title: str
    jurisdiction: Optional[str] = None
    decisionDate: Optional[str] = None
    rawText: str


class EnrichRequest(BaseModel):
    items: List[EnrichItemInput] = Field(min_length=1, max_length=50)
    concepts: List[ConceptDef] = Field(min_length=1)
    # Défaut : LEGAL_WATCH_ENRICH_MODEL ou gpt-4o-mini. Liste fermée pour
    # qu'un appelant ne puisse pas choisir un modèle coûteux.
    model: Optional[Literal["gpt-4o-mini", "gpt-4o", "gpt-5.4-nano", "gpt-5.2"]] = None


class EnrichmentResult(BaseModel):
    """Sortie LLM stricte. Les concepts hors liste fermée sont rejetés
    (validation contextuelle dans enrichment.py)."""
    summary: str = Field(min_length=1)
    legalDomain: str
    concepts: List[str]
    impactLevel: Literal["haut", "moyen", "faible"]
    isEvolution: bool
    confidence: float = Field(ge=0.0, le=1.0)

    @field_validator("summary")
    @classmethod
    def _summary_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("summary vide")
        return v.strip()


class EnrichItemOutput(BaseModel):
    externalId: str
    status: Literal["enriched", "discarded", "error"]
    data: Optional[EnrichmentResult] = None
    error: Optional[str] = None


class EnrichResponse(BaseModel):
    results: List[EnrichItemOutput]
    usage: Dict[str, Any]  # {model, input_tokens, output_tokens}
