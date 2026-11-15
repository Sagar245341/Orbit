import smtplib
from email.message import EmailMessage
from urllib.parse import quote

from app.core.config import (
    FRONTEND_BASE_URL,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_STARTTLS,
    SMTP_USERNAME,
    SMTP_USE_SSL,
)


class EmailConfigurationError(RuntimeError):
    pass


def send_verification_email(email: str, username: str, token: str) -> None:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise EmailConfigurationError("SMTP_HOST and SMTP_FROM_EMAIL must be configured")
    if bool(SMTP_USERNAME) != bool(SMTP_PASSWORD):
        raise EmailConfigurationError("SMTP_USERNAME and SMTP_PASSWORD must both be configured")

    verification_url = f"{FRONTEND_BASE_URL}/verify-email?token={quote(token, safe='')}"
    message = EmailMessage()
    message["Subject"] = "Verify your Orbit email address"
    message["From"] = SMTP_FROM_EMAIL
    message["To"] = email
    message.set_content(
        f"Hi {username},\n\n"
        "Please verify your email address to finish creating your Orbit account:\n"
        f"{verification_url}\n\n"
        "This link expires in 24 hours. If you did not create an Orbit account, you can ignore this email."
    )
    message.add_alternative(
        f"""\
        <html>
          <body style="font-family:Arial,sans-serif;color:#252438;line-height:1.6">
            <h2>Welcome to Orbit, {username}.</h2>
            <p>Verify your email address to finish creating your account.</p>
            <p><a href="{verification_url}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#7865ee;color:#fff;text-decoration:none">Verify email address</a></p>
            <p style="font-size:13px;color:#777">This link expires in 24 hours. If you did not create an Orbit account, you can ignore this email.</p>
          </body>
        </html>
        """,
        subtype="html",
    )

    smtp_class = smtplib.SMTP_SSL if SMTP_USE_SSL else smtplib.SMTP
    with smtp_class(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        if not SMTP_USE_SSL and SMTP_STARTTLS:
            server.starttls()
        if SMTP_USERNAME:
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
        server.send_message(message)
