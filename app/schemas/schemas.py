from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=40, pattern=r"^[a-zA-Z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=16, max_length=256)

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    model_config = ConfigDict(from_attributes=True)

class RoomCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)

class RoomResponse(BaseModel):
    id: int
    name: str
    created_by: int
    model_config = ConfigDict(from_attributes=True)

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    room_id: int
    content: str
    created_at: datetime
    sender_username: str
