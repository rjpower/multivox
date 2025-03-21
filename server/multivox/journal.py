import json
import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types as genai_types
from pydantic import BaseModel, Field

from multivox.config import settings
from multivox.types import LANGUAGES

router = APIRouter(prefix="/api/journal", tags=["journal"])
logger = logging.getLogger(__name__)


class JournalEntryRequest(BaseModel):
    text: str
    practice_language_code: str = "en"
    native_language_code: str = "en"
    api_key: Optional[str] = None


class CorrectionSpan(BaseModel):
    start: int
    end: int
    suggestion: str
    type: str = Field(..., description="Type of correction (grammar, spelling, etc.)")
    explanation: str


class JournalAnalysisResponse(BaseModel):
    corrected_text: str
    spans: List[CorrectionSpan]
    feedback: str
    improved_text: str


@router.post("/analyze", response_model=JournalAnalysisResponse)
async def analyze_journal_entry(
    request: JournalEntryRequest,
) -> JournalAnalysisResponse:
    """
    Analyze a journal entry and provide language corrections.
    """
    api_key = request.api_key or settings.GEMINI_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=400, detail="API key is required but not provided"
        )

    client = genai.Client(
        api_key=api_key,
        http_options={"api_version": settings.GEMINI_API_VERSION},
    )

    practice_language = LANGUAGES.get(request.practice_language_code)
    if not practice_language:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported practice language code: {request.practice_language_code}",
        )
    
    native_language = LANGUAGES.get(request.native_language_code)
    if not native_language:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported native language code: {request.native_language_code}",
        )

    prompt = f"""
        I'm learning to write in {practice_language.name}. My native language is {native_language.name}. 
        Please analyze the following journal entry:

        "{request.text}"

        Format your response as valid JSON with this exact structure:
        {{
            "corrected_text": "Text with simple corrections",
            "spans": [
                {{
                    "start": 0,
                    "end": 5,
                    "suggestion": "Better wording",
                    "type": "grammar|spelling|style|vocabulary",
                    "explanation": "Brief explanation in {native_language.name}"
                }}
            ],
            "feedback": "Overall assessment of writing in {native_language.name}",
            "improved_text": "A more polished version of the original text"
        }}

        "spans" should include character position indices for each correction, so they can be highlighted inline:
        - start/end are character indices
        - suggestion is what to replace it with (in {practice_language.name})
        - type should be one of: "grammar", "spelling", "style", "vocabulary"
        - explanation should be brief and helpful in {native_language.name}
        - feedback should be in {native_language.name}

        Don't make too many corrections - focus on the most important ones.
        """

    message_parts: List[genai_types.ContentUnion] = [
        genai_types.Content(
            role="user",
            parts=[
                genai_types.Part(text=prompt),
            ],
        )
    ]
    response = client.models.generate_content(
        model=settings.JOURNAL_MODEL_ID,
        contents=message_parts,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(
                disable=True,
                maximum_remote_calls=0,
            ),
        ),
    )

    if not response.text:
        raise HTTPException(status_code=500, detail="Empty response from model")

    # Extract the JSON part of the response
    text = response.text.strip()

    # Remove any markdown code block formatting if present
    if text.startswith("```json"):
        text = text[7:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    try:
        return JournalAnalysisResponse.model_validate_json(text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to parse model response: {str(e)} -- {text}"
        )
