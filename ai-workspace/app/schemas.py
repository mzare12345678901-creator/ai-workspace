from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool = False
    is_active: bool = True
    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChatRequest(BaseModel):
    conversation_id: Optional[int] = None
    message: str
    file_ids: List[int] = []


class ChatResponse(BaseModel):
    conversation_id: int
    reply: str


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    class Config:
        orm_mode = True


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    class Config:
        orm_mode = True


class SettingsIn(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class AdminUserOut(BaseModel):
    id: int
    username: str
    email: str
    is_active: bool
    is_admin: bool
    created_at: datetime
    conversation_count: int = 0
    message_count: int = 0
    file_count: int = 0
    class Config:
        orm_mode = True


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_conversations: int
    total_messages: int
    total_files: int