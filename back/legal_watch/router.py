"""
Endpoints FastAPI du module veille juridique (stateless — pas d'accès base).

Appelés par backNode (jobs d'ingestion/enrichissement) avec le header
`x-internal-api-key`. Ce header est vérifié pour TOUTES les routes du serveur
par la garde globale `verifier_cle_interne` (app/main.py).
Ces endpoints ne sont pas exposés par le proxy public.
"""
import logging

from fastapi import APIRouter, HTTPException

from back.legal_watch import judilibre_client, legifrance_client, convention_client
from back.legal_watch.enrichment import DEFAULT_MODEL, enrich_items
from back.legal_watch.schemas import (
    EnrichRequest,
    EnrichResponse,
    FetchRequest,
    FetchResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/legal-watch", tags=["legal-watch"])


@router.post("/fetch", response_model=FetchResponse)
async def legal_watch_fetch(req: FetchRequest) -> FetchResponse:
    """Recherche d'une source (Judilibre ou Légifrance) + texte intégral.
    Stateless : la déduplication par hash et la persistance sont côté Node."""
    errors: list[str] = []
    try:
        if req.source == "legifrance":
            decisions = legifrance_client.collect_texts(
                queries=req.queries,
                date_start=req.date_start,
                date_end=req.date_end,
                max_texts=req.max_decisions,
                on_error=errors.append,
            )
        elif req.source == "convention_collective":
            decisions = convention_client.collect_conventions(conventions=req.conventions, on_error=errors.append)
            
        else:
            decisions = judilibre_client.collect_decisions(
                queries=req.queries,
                date_start=req.date_start,
                date_end=req.date_end,
                chamber=req.chamber,
                max_decisions=req.max_decisions,
                on_error=errors.append,
            )
    except RuntimeError as e:  # auth PISTE absente/invalide
        raise HTTPException(status_code=503, detail=str(e))

    logger.info(
        f"[legal-watch fetch] source={req.source} : {len(req.queries)} requêtes → "
        f"{len(decisions)} items, {len(errors)} erreurs"
    )
    return FetchResponse(
        decisions=decisions,
        report={
            "queries": len(req.queries),
            "decisions": len(decisions),
            "errors": errors,
        },
    )


@router.post("/enrich", response_model=EnrichResponse)
async def legal_watch_enrich(req: EnrichRequest) -> EnrichResponse:
    """Enrichit un batch d'items : résumé, domaine, concepts (liste fermée),
    impact, évolution. Validation Pydantic stricte + 1 retry par item."""
    try:
        results, usage = enrich_items(req.items, req.concepts,
                                      model=req.model or DEFAULT_MODEL)
    except RuntimeError as e:  # client OpenAI non configuré
        raise HTTPException(status_code=503, detail=str(e))
    return EnrichResponse(results=results, usage=usage)
