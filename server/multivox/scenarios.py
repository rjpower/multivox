import importlib.resources
import json
from typing import Sequence

from multivox.types import Scenario


def load_scenarios() -> Sequence[Scenario]:
    f = importlib.resources.open_text("multivox", "scenarios.json")
    return [Scenario.model_validate(s) for s in json.load(f)]


SCENARIOS = load_scenarios()


def list_scenarios():
    return SCENARIOS
