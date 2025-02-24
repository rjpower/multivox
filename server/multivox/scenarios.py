import importlib.resources
import json
from typing import List, Sequence

from multivox.types import Scenario


def load_scenarios() -> List[Scenario]:
    f = (importlib.resources.files("multivox") / "scenarios.json").open("r")
    return [Scenario.model_validate(m) for m in json.load(f)]


SCENARIOS = load_scenarios()

def list_scenarios() -> Sequence[Scenario]:
    """Return all conversations from all chapters (for backwards compatibility)"""
    return SCENARIOS


def get_scenario(conversation_id: str) -> Scenario:
    """Get a specific conversation by ID"""
    for s in SCENARIOS:
        if s.id == conversation_id:
            return s
    raise KeyError(f"Conversation not found: {conversation_id}")
