from typing import Optional

from fastapi import WebSocket
from pydantic import ValidationError

from .types import WebSocketMessage


class TypedWebSocket:
    """Wrapper around WebSocket that only allows sending/receiving WebSocketMessage objects"""

    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

    async def accept(self):
        await self.websocket.accept()

    async def close(self, code: int = 1000, reason: Optional[str] = None):
        await self.websocket.close(code=code, reason=reason)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        return None

    @property
    def client_state(self):
        return self.websocket.client_state

    @property
    def url(self):
        return self.websocket.url

    async def receive_message(self) -> WebSocketMessage:
        """Receive and validate a WebSocketMessage"""
        data = await self.websocket.receive_json()
        try:
            return WebSocketMessage.model_validate(data)
        except ValidationError as e:
            raise ValueError(f"Invalid WebSocketMessage: {e} -- {data}")

    async def send_message(self, message: WebSocketMessage):
        """Send a WebSocketMessage"""
        await self.websocket.send_json(message.model_dump())
