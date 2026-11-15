import logging
import re
import secrets
import hashlib
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
import smtplib
from authlib.integrations.base_client.errors import OAuthError
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi import Request
from fastapi.responses import RedirectResponse
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.database.models import EmailVerification, OAuthAccount, User
from app.schemas.schemas import (
    RegisterRequest,
    LoginRequest,
    VerifyEmailRequest,
    ResendVerificationRequest,
    TokenResponse,
    UserResponse,
)
from app.core.security import hash_password, verify_password, create_access_token
from app.core.config import GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
from app.api.deps import get_current_user
from app.services.email_service import EmailConfigurationError, send_verification_email

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)
VERIFICATION_TTL = timedelta(hours=24)

oauth = OAuth()
if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def google_error_redirect(error: str) -> RedirectResponse:
    return RedirectResponse(f"/#oauth_error={quote(error, safe='')}", status_code=303)


def google_username(db: Session, user_info: Mapping, email: str) -> str:
    display_name = user_info.get("name")
    if not isinstance(display_name, str) or not display_name.strip():
        display_name = email.partition("@")[0]
    base = re.sub(r"[^a-zA-Z0-9_]", "_", display_name).strip("_")[:40]
    if len(base) < 3:
        base = "google_user"

    username = base
    while db.query(User.id).filter(User.username == username).first():
        suffix = "_" + secrets.token_hex(3)
        username = f"{base[:40 - len(suffix)]}{suffix}"
    return username


def make_verification_token() -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hashlib.sha256(token.encode("utf-8")).hexdigest()


def send_verification_or_raise(email: str, username: str, token: str) -> None:
    try:
        send_verification_email(email, username, token)
    except (EmailConfigurationError, smtplib.SMTPException, OSError) as error:
        logger.error("Could not send an account verification email: %s", error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Your account was created, but the verification email could not be sent. Please request a new email.",
        ) from error


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(
        or_(User.email == data.email.lower(), User.username == data.username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email or username is already registered")

    user = User(
        username=data.username,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.flush()
    token, token_hash = make_verification_token()
    db.add(EmailVerification(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + VERIFICATION_TTL,
    ))
    db.commit()
    db.refresh(user)
    send_verification_or_raise(user.email, user.username, token)
    return user


@router.post("/verify-email")
def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(data.token.encode("utf-8")).hexdigest()
    verification = db.query(EmailVerification).filter_by(token_hash=token_hash).first()
    if verification is None:
        raise HTTPException(status_code=400, detail="This verification link is invalid or has expired.")
    expires_at = verification.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="This verification link has expired. Request a new one.")

    verification.verified_at = datetime.now(timezone.utc)
    verification.token_hash = None
    db.commit()
    return {"message": "Your email has been verified. You can now sign in."}


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(data: ResendVerificationRequest, db: Session = Depends(get_db)):
    response = {"message": "If that address has a pending account, a verification email has been sent."}
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if user is None:
        return response

    verification = db.query(EmailVerification).filter_by(user_id=user.id).first()
    if verification is None or verification.verified_at is not None:
        return response

    token, token_hash = make_verification_token()
    verification.token_hash = token_hash
    verification.expires_at = datetime.now(timezone.utc) + VERIFICATION_TTL
    db.commit()
    send_verification_or_raise(user.email, user.username, token)
    return response


@router.get("/google", name="google_login")
async def google_login(request: Request):
    client = oauth.create_client("google")
    if client is None:
        return google_error_redirect("google_not_configured")
    redirect_uri = GOOGLE_REDIRECT_URI or str(request.url_for("google_callback"))
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/google/callback", name="google_callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    client = oauth.create_client("google")
    if client is None:
        return google_error_redirect("google_not_configured")

    try:
        token = await client.authorize_access_token(request)
    except (OAuthError, httpx.HTTPError) as error:
        logger.warning("Google OAuth callback failed: %s", error)
        return google_error_redirect("google_signin_failed")

    user_info = token.get("userinfo")
    if not isinstance(user_info, Mapping):
        return google_error_redirect("google_signin_failed")

    google_id = user_info.get("sub")
    email = user_info.get("email")
    if (
        not isinstance(google_id, str)
        or not google_id
        or not isinstance(email, str)
        or not email.strip()
        or user_info.get("email_verified") is not True
    ):
        return google_error_redirect("google_email_unverified")
    email = email.strip().lower()

    account = db.query(OAuthAccount).filter_by(
        provider="google",
        provider_user_id=google_id,
    ).first()
    if account is not None:
        user = db.get(User, account.user_id)
        if user is None:
            return google_error_redirect("google_signin_failed")
    else:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(
                username=google_username(db, user_info, email),
                email=email,
                password_hash=hash_password(secrets.token_urlsafe(32)),
            )
            db.add(user)
            db.flush()
        db.add(OAuthAccount(
            user_id=user.id,
            provider="google",
            provider_user_id=google_id,
        ))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            account = db.query(OAuthAccount).filter_by(
                provider="google",
                provider_user_id=google_id,
            ).first()
            if account is None:
                logger.warning("Google account could not be linked to a local user")
                return google_error_redirect("google_account_conflict")
            user = db.get(User, account.user_id)
            if user is None:
                return google_error_redirect("google_signin_failed")

    verification = db.query(EmailVerification).filter_by(user_id=user.id).first()
    if verification is not None and verification.verified_at is None:
        verification.verified_at = datetime.now(timezone.utc)
        verification.token_hash = None
        db.commit()

    access_token = create_access_token(user.id)
    return RedirectResponse(
        f"/#access_token={quote(access_token, safe='')}",
        status_code=303,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    verification = db.query(EmailVerification).filter_by(user_id=user.id).first()
    if verification is not None and verification.verified_at is None:
        raise HTTPException(status_code=403, detail="Please verify your email before signing in. You can request a new verification email.")

    return TokenResponse(
        access_token=create_access_token(user.id),
        username=user.username,
    )

@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
