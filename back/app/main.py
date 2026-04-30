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




@app.post("/extract-pdf-text")
async def extract_pdf_text(file: UploadFile = File(...), scan: bool = Form(False)):
    """Traite un fichier PDF de manière synchrone et retourne le texte et les clauses."""
    if file.filename == "" or not allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="Type de fichier non autorisé")


    content = await file.read()
    html_formatte = _extract_html_from_pdf_dict(content)
    print("EXTRACT PDF CONTENT IN HTML : ", html_formatte[:1000])
    texte_brut = _extract_text_from_pdf_content(content, scan) #  remplcé par html_formatte
    texte_corrige = corriger_espaces(texte_brut)
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
        "extraction_method": "server",
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
    return all_results[:3]


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
