import os
import sys
import imaplib
import email
from email.header import decode_header
from email.utils import parseaddr, parsedate_to_datetime
import datetime
import json
import re

# Add apps/api directory to path to ensure imports work correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from database import SessionLocal
    from models.ticket import Ticket
except ImportError as e:
    print(f"Error importing database session/models: {e}")
    print("Please make sure you run this script from the apps/api directory of the project.")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None


def decode_header_value(header_val):
    if not header_val:
        return ""
    try:
        decoded = decode_header(header_val)
        parts = []
        for text, charset in decoded:
            if isinstance(text, bytes):
                try:
                    parts.append(text.decode(charset or 'utf-8', errors='replace'))
                except Exception:
                    parts.append(text.decode('latin1', errors='replace'))
            else:
                parts.append(str(text))
        return "".join(parts)
    except Exception:
        return str(header_val)


def get_body_text(msg):
    body = ""
    if msg.is_multipart():
        # Look for text/plain first
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/plain" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        return payload.decode('utf-8', errors='replace')
                except Exception:
                    pass

        # Fallback to text/html
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))
            if content_type == "text/html" and "attachment" not in content_disposition:
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        html_content = payload.decode('utf-8', errors='replace')
                        if BeautifulSoup:
                            soup = BeautifulSoup(html_content, "html.parser")
                            return soup.get_text()
                        else:
                            # Basic regex replacement of HTML tags if BeautifulSoup is missing
                            clean_text = re.sub('<[^<]+?>', '', html_content)
                            return clean_text
                except Exception:
                    pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode('utf-8', errors='replace')
        except Exception:
            pass
    return body


def main():
    print("=========================================================")
    print("📧 WaiRaiders IMAP Email Importer / Backfiller")
    print("=========================================================")

    # Get IMAP settings interactively
    imap_server = input("Enter IMAP Server (e.g. imap.gmail.com, mail.wairaiders.com): ").strip()
    if not imap_server:
        print("IMAP Server is required.")
        return

    email_user = input("Enter Email Address (e.g. contact@wairaiders.com): ").strip()
    if not email_user:
        print("Email Address is required.")
        return

    email_pass = input("Enter Password / App Password: ").strip()
    if not email_pass:
        print("Password is required.")
        return

    mailbox_folder = input("Enter Mailbox Folder to Import (default: INBOX): ").strip() or "INBOX"

    print("\nConnecting to IMAP server...")
    try:
        mail = imaplib.IMAP4_SSL(imap_server)
        mail.login(email_user, email_pass)
        print("Successfully logged in!")
    except Exception as e:
        print(f"❌ Failed to connect or log in: {e}")
        return

    # Select the folder
    status, data = mail.select(mailbox_folder)
    if status != "OK":
        print(f"❌ Folder '{mailbox_folder}' not found.")
        return

    # Search for all messages
    print(f"Searching messages in folder '{mailbox_folder}'...")
    status, messages = mail.search(None, "ALL")
    if status != "OK":
        print("❌ Error searching messages.")
        return

    mail_ids = messages[0].split()
    total_emails = len(mail_ids)
    print(f"Found {total_emails} emails to process.")

    if total_emails == 0:
        print("No emails found to import.")
        return

    db = SessionLocal()
    imported_count = 0
    threaded_count = 0

    try:
        # Loop through messages (oldest to newest)
        for i, mail_id in enumerate(mail_ids):
            # Fetch message data
            status, msg_data = mail.fetch(mail_id, "(RFC822)")
            if status != "OK":
                print(f"[{i+1}/{total_emails}] Error fetching message ID {mail_id.decode()}")
                continue

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    # Parse the message bytes
                    msg = email.message_from_bytes(response_part[1])

                    # Extract Subject
                    subject = decode_header_value(msg.get("Subject", "No Subject"))

                    # Extract From address
                    from_header = decode_header_value(msg.get("From"))
                    sender_name, sender_email = parseaddr(from_header)
                    sender_name = sender_name or sender_email.split("@")[0]

                    # Extract Date
                    date_header = msg.get("Date")
                    try:
                        received_at = parsedate_to_datetime(date_header)
                    except Exception:
                        received_at = datetime.datetime.now(datetime.timezone.utc)

                    # Extract body text
                    body = get_body_text(msg)

                    print(f"[{i+1}/{total_emails}] Processing: '{subject}' from {sender_email} ({received_at.strftime('%Y-%m-%d %H:%M')})")

                    # Deduplication & Threading: Check if there's an existing open/pending ticket
                    # or a ticket with the same customer email and subject (ignoring "Re:")
                    clean_subject = re.sub(r'^(Re|Fwd|re|fwd|RE|FWD):\s*', '', subject).strip().lower()

                    existing_ticket = db.query(Ticket).filter(
                        Ticket.customer_email == sender_email,
                        (Ticket.status.in_(["open", "pending"])) | (db.func.lower(Ticket.subject).contains(clean_subject))
                    ).order_by(Ticket.created_at.desc()).first()

                    if existing_ticket:
                        # Thread reply to existing ticket
                        replies_list = []
                        if existing_ticket.replies:
                            try:
                                replies_list = json.loads(existing_ticket.replies)
                            except Exception:
                                pass

                        now_str = received_at.strftime("%H:%M %d/%m")
                        continuation_msg = f"[Customer Reply | {now_str}] {body}"
                        
                        # Prevent duplicate thread replies
                        if continuation_msg not in replies_list:
                            replies_list.append(continuation_msg)
                            existing_ticket.replies = json.dumps(replies_list)
                            # Keep or revert ticket to open status
                            existing_ticket.status = "open"
                            threaded_count += 1
                    else:
                        # Spawn new ticket
                        new_ticket = Ticket(
                            customer_name=sender_name,
                            customer_email=sender_email,
                            subject=subject,
                            message=body,
                            status="open",
                            replies="[]",
                            created_at=received_at
                        )
                        db.add(new_ticket)
                        imported_count += 1

            # Commit periodically
            if i % 10 == 0:
                db.commit()

        db.commit()
        print("\n=========================================================")
        print("🎉 BACKFILL COMPLETED SUCCESSFULLY!")
        print(f"Created {imported_count} new tickets.")
        print(f"Threaded {threaded_count} messages into existing tickets.")
        print("=========================================================")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Error during import: {e}")
    finally:
        db.close()
        mail.logout()


if __name__ == "__main__":
    main()
