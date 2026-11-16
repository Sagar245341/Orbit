from datetime import datetime
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

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
    description: str = Field(default="", max_length=1000)
    icon_url: str | None = Field(default=None, max_length=500)
    room_type: Literal["public", "private"] = "public"
    category: str | None = Field(default=None, max_length=60)
    max_members: int | None = Field(default=None, ge=1, le=10000)

    @model_validator(mode="after")
    def validate_room_fields(self):
        self.name = self.name.strip()
        if len(self.name) < 2:
            raise ValueError("Room names need at least 2 characters")
        if self.icon_url is not None:
            self.icon_url = self.icon_url.strip() or None
            if self.icon_url:
                parsed_icon_url = urlsplit(self.icon_url)
                if parsed_icon_url.scheme and (
                    parsed_icon_url.scheme not in ("http", "https") or not parsed_icon_url.netloc
                ):
                    raise ValueError("Icon URL must use HTTP or HTTPS")
                if self.icon_url.startswith("//"):
                    raise ValueError("Icon URL must be an absolute web URL or a same-origin path")
        if self.category is not None:
            self.category = self.category.strip() or None
        return self

class RoomResponse(BaseModel):
    id: int
    name: str
    created_by: int
    owner_id: int
    description: str
    icon_url: str | None
    room_type: Literal["public", "private"]
    category: str | None
    max_members: int | None
    member_count: int
    owner_username: str | None = None
    is_member: bool = True
    current_user_role: Literal["owner", "moderator", "member"] | None = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class RoomCreatedResponse(RoomResponse):
    invite_code: str
    invite_url: str

class RoomPageResponse(BaseModel):
    items: list[RoomResponse]
    total: int
    page: int
    page_size: int

class RoomMemberResponse(BaseModel):
    id: int
    username: str
    role: Literal["owner", "moderator", "member"]
    joined_at: datetime

class ChannelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    topic: str = Field(default="", max_length=500)
    category: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def normalize_fields(self):
        self.name = self.name.strip()
        self.topic = self.topic.strip()
        if not self.name:
            raise ValueError("Channel name cannot be blank")
        if self.category is not None:
            self.category = self.category.strip() or None
        return self

class ChannelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    topic: str | None = Field(default=None, max_length=500)
    category: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def normalize_fields(self):
        if self.name is not None:
            self.name = self.name.strip()
            if not self.name:
                raise ValueError("Channel name cannot be blank")
        if self.topic is not None:
            self.topic = self.topic.strip()
        if self.category is not None:
            self.category = self.category.strip() or None
        return self

class ChannelResponse(BaseModel):
    id: int
    room_id: int
    name: str
    topic: str
    category: str | None
    position: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InvitationCreate(BaseModel):
    expiration: Literal["never", "1h", "24h", "7d"] = "never"
    max_uses: Literal[1, 5, 10] | None = None

class InvitationResponse(BaseModel):
    id: int
    room_id: int
    invite_code: str
    invite_url: str
    created_by: int
    inviter_username: str
    expires_at: datetime | None
    max_uses: int | None
    used_count: int
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InvitationPreviewResponse(BaseModel):
    invite_code: str
    room: RoomResponse
    inviter_username: str
    expires_at: datetime | None
    max_uses: int | None
    used_count: int

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    room_id: int
    channel_id: int | None = None
    content: str
    created_at: datetime
    sender_username: str
