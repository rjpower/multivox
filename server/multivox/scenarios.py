import importlib.resources
from typing import List, Sequence

import yaml

from multivox.types import Scenario


def load_scenarios() -> List[Scenario]:
    with (importlib.resources.files("multivox") / "scenarios.yaml").open("r") as f:
        return [Scenario.model_validate(m) for m in yaml.safe_load(f)]


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
