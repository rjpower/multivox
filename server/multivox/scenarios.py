from typing import Sequence

from multivox.types import Scenario


def list_scenarios() -> Sequence[Scenario]:
    """Return list of available practice scenarios"""
    return [
        Scenario(
            id="hotel",
            title="Checking into a hotel",
            instructions="""
We are going to role-play a scenario.

You are a hotel receptionist.
You act _exactly_ as a hotel receptionist at a front desk would.
Do not break character under any circumstances.
You don't know any other languages.
Don't explain yourself or refer to yourself e.g. as "I'm a helpful receptionist".

A guest approaches...
""",
        ),
        Scenario(
            id="restaurant",
            title="Ordering at a restaurant",
            instructions="You are a waiter at a casual restaurant. Take the customer's order and answer questions about the menu.",
        ),
        Scenario(
            id="directions",
            title="Asking for directions",
            instructions="You are a local resident. Help the tourist find their way to popular attractions and recommend places to visit.",
        ),
    ]
