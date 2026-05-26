from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Set
import os
import requests
import asyncio
from starlette.concurrency import run_in_threadpool


#Max de requette en simultané
semaphore = asyncio.Semaphore(5)


from back.services.pdf_processing import (
    allowed_file,
    is_word_file,
    extract_text_from_word,
    corriger_espaces,
    extract_clauses_ia_robuste,
    _extract_text_from_pdf_content,
    _extract_html_from_pdf_dict,
    _extract_keywords_basic,
    _sanitize_query_text,
    _legifrance_search,
    _judilibre_search,
    _openai_client,
)

from .logging_setup import setup_logging
import logging

setup_logging("INFO")

logger = logging.getLogger(__name__)

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
) 


HF_TOKEN = os.environ.get("HF_TOKEN") #Hugging Face


class SearchRequest(BaseModel):
    query: str
    limit: int = 3


class JurisprudenceRequest(BaseModel):
    queries: List[str]


class ClassifyVeilleRequest(BaseModel):
    articles: List[Dict[str, str]]  # [{title, description}, ...]


class AnalyzeClauseRequest(BaseModel):
    clauseText: str
    question: str
    clauseType: Optional[str] = None



class OpenAIRequestGpt5(BaseModel):
    prompt: str
    reasoning : str
    verbosity : str
    model: str = "gpt-5.2"



class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = ""
    history: List[ChatMessage] = []
    model: str = "gpt-4o"


class OpenAIChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    model: str = "gpt-4o"
    temperature: float = 0.3
    max_tokens: int = 800
    response_format: Optional[Dict[str, Any]] = None


class HFRequest(BaseModel):
    model: str
    inputs: str
    parameters: Optional[Dict[str, Any]] = None


def extract_token_usage(response: Any, model: str) -> Dict[str, Any]:
    usage = getattr(response, "usage", None)

    def usage_value(*keys: str) -> int:
        if not usage:
            return 0

        for key in keys:
            value = usage.get(key) if isinstance(usage, dict) else getattr(usage, key, None)
            if value is not None:
                return int(value)

        return 0

    return {
        "model": model,
        "input_tokens": usage_value("input_tokens", "prompt_tokens"),
        "output_tokens": usage_value("output_tokens", "completion_tokens"),
    }




@app.post("/extract-document-text")
async def extract_pdf_text(file: UploadFile = File(...), scan: bool = Form(False)):
    """Traite un fichier PDF ou Word et retourne le texte et les clauses."""
    if file.filename == "" or not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Type de fichier non autorisé (PDF ou WORD requis)")

    content = await file.read()

    if is_word_file(file.filename):
        try:
            texte_brut, html_formatte = extract_text_from_word(content)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        texte_corrige = corriger_espaces(texte_brut)
        extraction_method = "word"
    else:
        try :html_formatte = _extract_html_from_pdf_dict(content)
        except ValueError as e: raise HTTPException(status_code=422, detail=str(e))
        print("EXTRACT PDF CONTENT IN HTML : ", html_formatte[:1000])
        texte_brut = _extract_text_from_pdf_content(content, scan)
        texte_corrige = corriger_espaces(texte_brut)
        extraction_method = "server"

    clauses_detectees = extract_clauses_ia_robuste(texte_corrige)
    texte_des_clauses = " ".join(c.get("text", "") for c in clauses_detectees)
    keywords = _extract_keywords_basic(texte_des_clauses, max_terms=10)

    return {
        "success": True,
        "text": texte_corrige,
        "html": html_formatte,
        "clauses": clauses_detectees,
        "keywords": keywords or [],
        "filename": file.filename,
        "extraction_method": extraction_method,
        "extraction_quality": "high" if len(texte_corrige) > 1000 else "medium",
        "pages": 1,
        "is_protected": False,
    }


@app.post("/legifrance-search")
async def legifrance_search(req: SearchRequest):
    query = _sanitize_query_text((req.query or "").strip())
    limit = min(max(req.limit, 1), 10)
    if not query:
        raise HTTPException(status_code=400, detail="Aucun terme de recherche fourni.")
    resultats = _legifrance_search(query, limit=limit)
    return {"success": True, "query": query, "resultats": resultats}


_VEILLE_TAGS = [
    "Rupture", "Temps de travail", "Rémunération", "Santé/Sécurité",
    "Discipline", "Relations collectives", "Protection sociale", "Recrutement",
]

@app.post("/classify-veille")
async def classify_veille(req: ClassifyVeilleRequest):
    if not req.articles:
        return []
    if not _openai_client:
        raise HTTPException(status_code=503, detail="Service IA non disponible")

    tag_list = ", ".join(_VEILLE_TAGS)
    lines = "\n".join(
        f"{i+1}. \"{a.get('title','')}\" — {a.get('description','')[:150]}"
        for i, a in enumerate(req.articles)
    )
    prompt = (
        f"Tu es un expert RH et droit du travail français.\n"
        f"Classe chaque actualité dans l'une de ces catégories : {tag_list}.\n"
        f"Réponds \"null\" si l'actualité n'est pas directement liée au droit du travail ou aux RH, "
        f"OU si elle ne s'applique pas concrètement à un employeur ou un service RH "
        f"(ex : politique étrangère, défense, environnement, textes sans impact employeur).\n"
        f"Réponds UNIQUEMENT avec une ligne par actualité, format exact :\n"
        f"1. <catégorie ou null>\n2. <catégorie ou null>\n...\n\n"
        f"Actualités :\n{lines}"
    )

    def _call():
        return _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=len(req.articles) * 15,
        )

    resp = await run_in_threadpool(_call)
    output = (resp.choices[0].message.content or "").strip()

    results = [None] * len(req.articles)
    for line in output.splitlines():
        m = __import__("re").match(r"^(\d+)\.\s*(.+)$", line.strip())
        if not m:
            continue
        idx = int(m.group(1)) - 1
        val = m.group(2).strip()
        if 0 <= idx < len(req.articles) and val in _VEILLE_TAGS:
            results[idx] = val

    return results


def _structure_decision_summary(decision: Dict[str, Any]) -> Dict[str, Any]:
    """Enrichit une décision avec un résumé structuré (litige + résultat) via OpenAI."""
    if not _openai_client:
        return decision

    title = decision.get("title", "")
    court = decision.get("court", "")
    date = decision.get("date", "")
    summary = decision.get("summary", "")
    solution = decision.get("solution", "")
    zones = decision.get("zones", {}) or {}
    highlights = decision.get("highlights", "")

    # Assembler tout le contenu textuel disponible
    content_parts = []
    if zones.get("expose_moyens"):
        content_parts.append(f"Exposé des moyens : {zones['expose_moyens']}")
    if zones.get("motivation"):
        content_parts.append(f"Motivation : {zones['motivation']}")
    if zones.get("dispositif"):
        content_parts.append(f"Dispositif : {zones['dispositif']}")
    if highlights:
        content_parts.append(f"Extraits pertinents : {highlights}")
    if summary:
        content_parts.append(f"Résumé : {summary}")

    # Si aucun contenu réel disponible, ne pas appeler le LLM (évite les hallucinations)
    has_content = bool(content_parts or solution)
    if not has_content:
        return decision

    context_lines = []
    if title:
        context_lines.append(f"Décision : {title}")
    if court:
        context_lines.append(f"Juridiction : {court}")
    if date:
        context_lines.append(f"Date : {date}")
    if solution:
        context_lines.append(f"Solution : {solution}")
    context_lines.extend(content_parts)

    prompt = (
        "Tu es un juriste expert en droit français. Analyse cette décision de justice et rédige deux phrases précises :\n"
        "1. LITIGE : Décris factuellement le litige (quelles parties, quel contrat ou situation, quel désaccord précis).\n"
        "2. RESULTAT : Indique le résultat concret (cassation/rejet/irrecevabilité, au profit de qui, pour quel motif juridique).\n\n"
        "Sois factuel et précis. N'invente rien qui ne soit pas dans le texte. "
        "Format STRICT (deux lignes) :\n"
        "LITIGE: <phrase factuelle>\n"
        "RESULTAT: <phrase factuelle>\n\n"
        + "\n".join(context_lines)
    )

    try:
        resp = _openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=250,
        )
        text = resp.choices[0].message.content.strip()
        # Normaliser : séparer LITIGE: et RESULTAT: même s'ils sont sur la même ligne
        import re as _re
        litige_m = _re.search(r'LITIGE:\s*(.+?)(?=RESULTAT:|$)', text, _re.DOTALL)
        resultat_m = _re.search(r'RESULTAT:\s*(.+?)$', text, _re.DOTALL)
        if litige_m:
            decision["litige"] = litige_m.group(1).strip()
        if resultat_m:
            decision["resultat"] = resultat_m.group(1).strip()
    except Exception as e:
        logger.warning(f"[structure_decision_summary] Erreur OpenAI: {e}")

    return decision


@app.post("/jurisprudence")
async def jurisprudence(req: JurisprudenceRequest):
    if not req.queries:
        raise HTTPException(status_code=400, detail="Requête invalide, 'queries' manquant.")
    all_results: List[Dict[str, Any]] = []
    seen_urls: Set[str] = set()
    judilibre_results = _judilibre_search(req.queries[0]) if req.queries else []
    for res in judilibre_results:
        url = res.get("url")
        if url and url not in seen_urls:
            all_results.append(res)
            seen_urls.add(url)
    if len(all_results) < 3 and req.queries:
        legifrance_results = _legifrance_search(req.queries[0], limit=3)
        for res in legifrance_results:
            url = res.get("url")
            if url and url not in seen_urls:
                all_results.append(res)
                seen_urls.add(url)
    decisions = all_results[:3]
    enriched = await asyncio.gather(
        *[run_in_threadpool(_structure_decision_summary, d) for d in decisions]
    )
    return list(enriched)


@app.post("/analyze-clause")
async def analyze_clause(req: AnalyzeClauseRequest):
    if not req.clauseText or not req.question:
        raise HTTPException(status_code=400, detail="Texte de clause ou question manquant")
    if not _openai_client:
        raise HTTPException(status_code=503, detail="Service d'analyse non disponible")
    prompt = f"""Tu es un expert juridique français spécialisé en droit des contrats.

Contexte : Analyse d'une {req.clauseType or 'clause contractuelle'}

Clause à analyser :
{req.clauseText[:2000]}

Question : {req.question}

Réponds de manière claire, structurée et professionnelle en 3-4 paragraphes maximum.
Si la question concerne les risques, identifie les principaux points d'attention juridiques.
Si la question demande des améliorations, propose des reformulations concrètes."""
    response = _openai_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=500,
    )
    answer = response.choices[0].message.content.strip()
    return {
        "success": True,
        "answer": answer,
        "question": req.question,
        "openai_tokens": extract_token_usage(response, "gpt-4o"),
    }




@app.post("/chat")
async def chat(req: ChatRequest):
    if not req.message:
        raise HTTPException(status_code=400, detail="Message manquant")
    if not _openai_client:
        raise HTTPException(status_code=503, detail="Service de chat non disponible")
    messages = [
        {
            "role": "system",
            "content": "Tu es un assistant juridique expert en droit français, spécialisé dans l'analyse de contrats.\nTu fournis des conseils clairs, précis et adaptés au contexte français.\nReste professionnel mais accessible. Utilise des exemples concrets quand c'est pertinent.",
        }
    ]
    if req.context:
        messages.append({"role": "system", "content": f"Contexte du document analysé:\n{req.context[:2000]}"})
    for h in req.history[-10:]:
        if h.role and h.content:
            messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    if req.model in {"gpt-5.2", "gpt-5.4-nano"}:
        response = await run_in_threadpool(
            lambda: _openai_client.responses.create(
                model=req.model,
                input=messages,
                reasoning={"effort": "medium"},
                text={"verbosity": "medium"},
            )
        )
        assistant_response = response.output_text.strip()
        return {
            "success": True,
            "response": assistant_response,
            "openai_tokens": extract_token_usage(response, req.model),
        }

    response = _openai_client.chat.completions.create(
        model=req.model,
        messages=messages,
        temperature=0.7,
        max_tokens=800,
    )
    assistant_response = response.choices[0].message.content.strip()
    return {
        "success": True,
        "response": assistant_response,
        "openai_tokens": extract_token_usage(response, req.model),
    }



@app.post("/openai-chat")
async def openai_chat(req: OpenAIChatRequest):
    if not _openai_client:
        raise HTTPException(status_code=503, detail="Service OpenAI non configuré")
    params = {
        "model": req.model,
        "messages": req.messages,
        "temperature": req.temperature,
        "max_tokens": req.max_tokens,
    }
    if req.response_format:
        params["response_format"] = req.response_format
    try:
        response = _openai_client.chat.completions.create(**params)
        content = response.choices[0].message.content
        return {
            "content": content,
            "openai_tokens": extract_token_usage(response, req.model),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))





@app.post("/openai-chat-5")
async def openai_chat52(req:OpenAIRequestGpt5):

    if not _openai_client:
        raise HTTPException(status_code=503, detail="Service OpenAI non configuré")

    allowed_models = {"gpt-5.2", "gpt-5.4-nano"}
    if req.model not in allowed_models:
        raise HTTPException(status_code=400, detail=f"Modèle OpenAI non autorisé: {req.model}")
    
    try:
        #construction des parametres
        params = {
            "model": req.model,
            "input" : [
                {"role": "system", "content": "Tu es un expert en droit français, spécialisé en contrats et analyse de clauses à risque."},
                {"role": "user", "content": req.prompt}
            ],
            "reasoning" : { "effort" : req.reasoning},
            "text" : { "verbosity" : req.verbosity}
        }
        #Set temperature et top_p si on n'active pas le reasoning
        if req.reasoning == "none":
            params["temperature"] = 0.15
            params["top_p"] = 0.95

        async with semaphore:
        #call openai
            response = await run_in_threadpool(lambda: _openai_client.responses.create(**params))   
            
        #Renvois la réponse  
        content = response.output_text
        return {
            "content": content,
            "openai_tokens": extract_token_usage(response, req.model),
        }
    except Exception as e:
        import traceback
        print("❌ Erreur OpenAI:", type(e), e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))







@app.post("/huggingface-generate")
async def huggingface_generate(req: HFRequest):
    if not HF_TOKEN:
        raise HTTPException(status_code=503, detail="Service HuggingFace non configuré")
    url = f"https://api-inference.huggingface.co/models/{req.model}"
    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    payload = {"inputs": req.inputs}
    if req.parameters:
        payload["parameters"] = req.parameters
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        r.raise_for_status()
        data = r.json()
        text = ""
        if isinstance(data, list) and data:
            text = data[0].get("generated_text", "")
        elif isinstance(data, dict):
            text = data.get("generated_text", "")
        return {"generated_text": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/summarize-case")
async def summarize_case():
    return JSONResponse({"success": False, "summary": "", "error": "Non implémenté"}, status_code=501)

@app.get("/")
async def root():
    logger.info("info test")
    logger.warning("warning test")
    logger.error("error test")
    return {"status": "ok"}
