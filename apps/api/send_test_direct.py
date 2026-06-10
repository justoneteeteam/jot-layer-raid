import os
import sys
from dotenv import load_dotenv

# Load apps/api/.env
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Add apps/api directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from routers.oms import actual_send_email

def main():
    print("=== Sending Outbound Test Email ===")
    print(f"From: contact@wairaiders.com")
    print(f"To: qctp2017@gmail.com")
    print(f"Account ID: {os.getenv('CLOUDFLARE_ACCOUNT_ID')}")
    
    success = actual_send_email(
        to_email="qctp2017@gmail.com",
        subject="Outbound Routing Test - contact@wairaiders.com",
        body_text="Hello!\n\nThis is a test email sent from contact@wairaiders.com via Cloudflare REST API to verify your outbound routing configuration.",
        from_email="contact@wairaiders.com"
    )
    if success:
        print("\n🎉 SUCCESS! Test email sent successfully to qctp2017@gmail.com.")
    else:
        print("\n❌ FAILED! Test email dispatch failed. Please check your credentials and logs.")

if __name__ == "__main__":
    main()
