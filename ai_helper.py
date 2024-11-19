import os
import logging
from openai import OpenAI
from enum import Enum
import json
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
MISTRAL_API_KEY = os.environ.get("MISTRAL_API_KEY")

openai_client = OpenAI(api_key=OPENAI_API_KEY)

class AIModel(Enum):
    GPT4O_MINI = "gpt-4o-mini"  # Lighter model for simple tasks
    GPT4O = "gpt-4o"  # More powerful model for complex tasks
    CLAUDE = "claude-2"  # Anthropic's model for alternative perspectives
    MISTRAL = "mistral-large"  # Mistral's model for additional insights

def create_chain_prompt(content: str, previous_insights: list = None) -> str:
    """Create a context-aware prompt incorporating previous insights."""
    base_prompt = f"Analyze this content: '{content}'\n\n"
    
    if previous_insights:
        base_prompt += "Previous AI insights:\n"
        for insight in previous_insights:
            base_prompt += f"- {insight['model']}: {insight['content']}\n"
        base_prompt += "\nBuild upon these insights and provide new perspectives.\n"
    
    return base_prompt

def chain_llm_responses(content: str, previous_interactions: list = None) -> dict:
    """Chain responses from multiple LLMs for comprehensive analysis."""
    insights = []
    
    # First analysis with GPT-4
    gpt4_prompt = create_chain_prompt(content, insights)
    gpt4_response = openai_client.chat.completions.create(
        model=AIModel.GPT4O.value,
        messages=[{"role": "user", "content": gpt4_prompt}],
        max_tokens=500
    )
    insights.append({
        "model": "GPT-4",
        "content": gpt4_response.choices[0].message.content
    })
    
    # Additional analysis with other models
    models_to_use = [
        (AIModel.CLAUDE.value, ANTHROPIC_API_KEY),
        (AIModel.MISTRAL.value, MISTRAL_API_KEY)
    ]
    
    for model, api_key in models_to_use:
        if api_key:
            prompt = create_chain_prompt(content, insights)
            # Implement model-specific API calls here
            # This is a placeholder for the actual implementation
            insights.append({
                "model": model,
                "content": f"Analysis from {model}"  # Placeholder
            })
    
    return {"chain_response": insights}

def get_note_suggestions(content: str, model: str = AIModel.GPT4O_MINI.value) -> str:
    prompt = f"Based on this note content: '{content}', suggest improvements and related topics."
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100
    )
    return response.choices[0].message.content

def categorize_note(content: str, model: str = AIModel.GPT4O_MINI.value) -> str:
    prompt = f"Categorize this note content into one word: '{content}'"
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=20
    )
    return response.choices[0].message.content.strip()

def suggest_tags(content: str, model: str = AIModel.GPT4O_MINI.value) -> list:
    prompt = f"Extract 3-5 relevant single-word tags from this note content. Return only the tags separated by commas: '{content}'"
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=50
    )
    tags = [tag.strip() for tag in response.choices[0].message.content.split(',')]
    return tags[:5]  # Ensure we don't exceed 5 tags

def enhance_note(content: str, model: str = AIModel.GPT4O.value) -> str:
    prompt = f"Enhance this note by improving grammar and clarity: '{content}'"
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200
    )
    return response.choices[0].message.content

def summarize_note(content: str, model: str = AIModel.GPT4O.value) -> str:
    prompt = f"Provide a concise summary of this note content in 2-3 sentences: '{content}'"
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100
    )
    return response.choices[0].message.content

def expand_idea(content: str, model: str = AIModel.GPT4O.value) -> dict:
    """Expand an idea with detailed analysis and related concepts."""
    prompt = f"""Analyze and expand this idea in detail. Provide:
    1. Main concept explanation
    2. Key implications
    3. Potential applications
    4. Related concepts
    5. Possible challenges
    Idea: '{content}'"""
    
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=500
    )
    return {"expanded": response.choices[0].message.content}

def analyze_concept(content: str, model: str = AIModel.GPT4O.value) -> dict:
    """Provide deep analysis of a concept or idea."""
    prompt = f"""Perform a comprehensive analysis of this concept:
    1. Core components
    2. Underlying principles
    3. Real-world applications
    4. Advantages and limitations
    5. Innovation potential
    Concept: '{content}'"""
    
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400
    )
    return {"analysis": response.choices[0].message.content}

def generate_related_ideas(content: str, model: str = AIModel.GPT4O.value) -> dict:
    """Generate related ideas and concepts for brainstorming."""
    prompt = f"""Generate 5 related ideas or concepts that could expand or complement this thought:
    1. Direct extensions
    2. Alternative approaches
    3. Complementary concepts
    4. Innovative applications
    5. Future possibilities
    Original idea: '{content}'"""
    
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=300
    )
    return {"related_ideas": response.choices[0].message.content}

def create_mind_map_suggestions(content: str, model: str = AIModel.GPT4O.value) -> dict:
    """Generate mind map structure suggestions for the given content."""
    prompt = f"""Create a mind map structure for this concept with:
    1. Central theme
    2. Main branches (4-6)
    3. Sub-branches (2-3 per main branch)
    4. Key connections
    5. Growth directions
    Content: '{content}'"""
    
    response = openai_client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=400
    )
    return {"mind_map": response.choices[0].message.content}

def transcribe_audio(audio_path: str) -> str:
    if not os.path.exists(audio_path):
        logger.error(f"Audio file not found at path: {audio_path}")
        return ""
        
    try:
        file_size = os.path.getsize(audio_path)
        logger.info(f"Processing audio file of size: {file_size} bytes")
        
        with open(audio_path, "rb") as audio_file:
            response = openai_client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="en",
                response_format="text",
                temperature=0.2
            )
            
        if not response:
            logger.warning("Transcription returned empty text")
            return ""
            
        logger.info(f"Transcription successful: {response[:100]}...")
        return response
        
    except Exception as e:
        logger.error(f"Error in transcription: {str(e)}", exc_info=True)
        return ""

def expand_idea_with_chain(content: str, previous_interactions: list = None) -> dict:
    """Expand an idea using chained LLM responses."""
    base_analysis = expand_idea(content)
    chain_response = chain_llm_responses(content, previous_interactions)
    
    return {
        "expanded": base_analysis["expanded"],
        "chain_insights": chain_response["chain_response"],
        "metadata": {
            "models_used": [model["model"] for model in chain_response["chain_response"]],
            "timestamp": datetime.utcnow().isoformat()
        }
    }

def analyze_concept_with_chain(content: str, previous_interactions: list = None) -> dict:
    """Analyze a concept using chained LLM responses."""
    base_analysis = analyze_concept(content)
    chain_response = chain_llm_responses(content, previous_interactions)
    
    return {
        "analysis": base_analysis["analysis"],
        "chain_insights": chain_response["chain_response"],
        "metadata": {
            "models_used": [model["model"] for model in chain_response["chain_response"]],
            "timestamp": datetime.utcnow().isoformat()
        }
    }