import logging
import httpx
import smtplib
from abc import ABC, abstractmethod
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

class EmailProvider(ABC):
    @abstractmethod
    def send_email(self, from_name: str, from_email: str, recipient: str, subject: str, html_body: str, text_body: str = "", reply_to: str = None, headers: dict = None) -> bool:
        pass

class CloudflareWorkerProvider(EmailProvider):
    def __init__(self, account_id: str, api_token: str):
        self.account_id = account_id
        self.api_token = api_token

    def send_email(self, from_name: str, from_email: str, recipient: str, subject: str, html_body: str, text_body: str = "", reply_to: str = None, headers: dict = None) -> bool:
        if not self.account_id or not self.api_token:
            logger.error("Cloudflare Worker Provider not configured: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is missing.")
            return False

        url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/email/sending/send"
        req_headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        if headers:
            req_headers.update(headers)

        payload = {
            "to": recipient,
            "from": f"{from_name} <{from_email}>" if from_name else from_email,
            "subject": subject,
            "text": text_body or "Please view this email in an HTML-compatible client.",
            "html": html_body
        }
        if reply_to:
            payload["reply_to"] = reply_to

        try:
            response = httpx.post(url, headers=req_headers, json=payload, timeout=10.0)
            response_json = response.json()
            if response.status_code == 200 and response_json.get("success"):
                logger.info(f"Cloudflare Worker Email successfully dispatched to {recipient}")
                return True
            else:
                logger.error(f"Cloudflare Email API error sending to {recipient}. Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Cloudflare email exception for {recipient}: {e}")
            return False

class ResendProvider(EmailProvider):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def send_email(self, from_name: str, from_email: str, recipient: str, subject: str, html_body: str, text_body: str = "", reply_to: str = None, headers: dict = None) -> bool:
        if not self.api_key:
            logger.warning("Resend Provider API key not configured. Simulating success.")
            return True

        url = "https://api.resend.com/emails"
        req_headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "from": f"{from_name} <{from_email}>" if from_name else from_email,
            "to": [recipient],
            "subject": subject,
            "html": html_body,
            "text": text_body or "Please view this email in HTML format."
        }
        if reply_to:
            payload["reply_to"] = reply_to
        if headers:
            payload["headers"] = headers

        try:
            response = httpx.post(url, headers=req_headers, json=payload, timeout=10.0)
            if response.status_code in (200, 201):
                logger.info(f"Resend Email successfully sent to {recipient}")
                return True
            else:
                logger.error(f"Resend Email API error for {recipient}. Response: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Resend Email exception for {recipient}: {e}")
            return False

class SMTPProvider(EmailProvider):
    def __init__(self, host: str, port: int, username: str, password: str, use_ssl: bool = True):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl

    def send_email(self, from_name: str, from_email: str, recipient: str, subject: str, html_body: str, text_body: str = "", reply_to: str = None, headers: dict = None) -> bool:
        if not self.host or not self.port:
            logger.warning("SMTP Provider configuration incomplete. Simulating success.")
            return True

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{from_name} <{from_email}>" if from_name else from_email
        msg["To"] = recipient
        if reply_to:
            msg["Reply-To"] = reply_to

        if headers:
            for k, v in headers.items():
                msg[k] = v

        part1 = MIMEText(text_body or "Please view this email in an HTML-compatible client.", "plain", "utf-8")
        part2 = MIMEText(html_body, "html", "utf-8")
        msg.attach(part1)
        msg.attach(part2)

        try:
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port, timeout=10.0)
            else:
                server = smtplib.SMTP(self.host, self.port, timeout=10.0)
                server.starttls()

            if self.username and self.password:
                server.login(self.username, self.password)

            server.sendmail(from_email, [recipient], msg.as_string())
            server.quit()
            logger.info(f"SMTP Email successfully sent to {recipient}")
            return True
        except Exception as e:
            logger.error(f"SMTP sending exception for {recipient}: {e}")
            return False

def get_email_provider(provider_type: str, config: dict) -> EmailProvider:
    provider_type = provider_type.lower()
    if provider_type == "cloudflare":
        return CloudflareWorkerProvider(
            account_id=config.get("cloudflare_account_id", ""),
            api_token=config.get("cloudflare_api_token", "")
        )
    elif provider_type == "resend":
        return ResendProvider(
            api_key=config.get("resend_api_key", "")
        )
    elif provider_type == "smtp":
        return SMTPProvider(
            host=config.get("smtp_host", ""),
            port=int(config.get("smtp_port", 587)),
            username=config.get("smtp_username", ""),
            password=config.get("smtp_password", ""),
            use_ssl=config.get("smtp_use_ssl", True)
        )
    else:
        # Fallback to standard SMTP / mock
        logger.warning(f"Unknown email provider '{provider_type}'. Defaulting to Mock.")
        class MockProvider(EmailProvider):
            def send_email(self, *args, **kwargs):
                logger.info(f"Simulating delivery with Mock Provider for {args}")
                return True
        return MockProvider()
