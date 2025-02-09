import logging
from typing import Optional

from fastapi import WebSocket
from fastapi.websockets import WebSocketState
from pydantic import ValidationError

from .types import WebSocketMessage, parse_websocket_message

logger = logging.getLogger(__name__)

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

    def connected(self):
        return self.websocket.client_state == WebSocketState.CONNECTED

    async def receive_message(self) -> WebSocketMessage:
        """Receive and validate a WebSocketMessage"""
        data = await self.websocket.receive_json()
        logger.info("C->S: %s", data["type"])
        try:
            return parse_websocket_message(data)
        except ValidationError as e:
            raise ValueError(f"Invalid WebSocketMessage: {e} -- {data}")

    async def send_message(self, message: WebSocketMessage):
        """Send a WebSocketMessage"""
        logger.info("S->C: %s", message.type)
        await self.websocket.send_text(message.model_dump_json())
