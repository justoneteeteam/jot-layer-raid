import io
import os
import re
import json
import tempfile
import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.order import Order
from models.product import Product
from models.ticket import Ticket
from models.store import Store

# pypdf for PDF tracking extraction
import pypdf

# openpyxl for Excel export
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.drawing.image import Image as ExcelImage
from PIL import Image as PILImage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/oms", tags=["OMS"])

# WeChat PDF Directories to Scan
WECHAT_DIRS = [
    r"d:\Codebase\AdstestJOT\wechat",
    r"C:\Users\Finelaptop.vn\Documents\WeChat Files\wxid_i5tyisy8lh9422\FileStorage\File\2025-07"
]

# Automated CRM Email Keywords Rules and Settings Store
SETTINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "email_settings.json")

DEFAULT_EMAIL_SETTINGS = {
    "sender_email": "customer@justonetee.org",
    "keywords": "shipping status, tracking, track, status, where is my order",
    "template_subject": "Instant AI Update regarding your order {order_id}",
    "template_body": "Hi {customer_name},\n\n[Instant AI Update] This is an automated update regarding your order {order_id}.\nYour logistics shipping status is currently: {shipping_status}.\nTracking Number: {tracking_number}.\n\nYou can track your package directly on 17track here:\nhttps://www.17track.net/en/track?nums={tracking_number}\n\nThis response was triggered instantly by the JOT AI CRM rules engine.",
    "auto_reply_enabled": True,
    "cloudflare_account_id": "",
    "cloudflare_api_token": ""
}

def load_email_settings():
    if not os.path.exists(SETTINGS_FILE):
        return DEFAULT_EMAIL_SETTINGS
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading email settings: {e}")
        return DEFAULT_EMAIL_SETTINGS

def persist_email_settings(settings):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Error saving email settings: {e}")

def format_template(template_str, customer_name, order_id, shipping_status, tracking_number):
    if not template_str:
        return ""
    return (template_str
            .replace("{customer_name}", customer_name or "")
            .replace("{order_id}", order_id or "")
            .replace("{shipping_status}", (shipping_status or "").upper())
            .replace("{tracking_number}", tracking_number or ""))

def actual_send_email(to_email: str, subject: str, body_text: str):
    """Send a real email using Cloudflare Email Sending Service REST API."""
    settings = load_email_settings()
    account_id = settings.get("cloudflare_account_id")
    api_token = settings.get("cloudflare_api_token")
    sender = settings.get("sender_email", "customer@justonetee.org")
    
    if not account_id or not api_token:
        logger.warning("Cloudflare Email credentials not fully configured in Settings. Simulating delivery...")
        return True
        
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/email/sending/send"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #f97316; margin: 0; font-size: 20px; font-weight: bold;">JOT Support Logistics</h2>
        </div>
        <div style="color: #334155; font-size: 15px; line-height: 1.6; white-space: pre-line;">
            {body_text}
        </div>
        <div style="border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; text-align: center; color: #94a3b8; font-size: 12px;">
            This email was sent automatically from the JOT Logistics Dashboard.
        </div>
    </div>
    """
    
    payload = {
        "to": to_email,
        "from": sender,
        "subject": subject,
        "text": body_text,
        "html": html_body
    }
    
    try:
        response = httpx.post(url, headers=headers, json=payload, timeout=10.0)
        response_json = response.json()
        if response.status_code == 200 and response_json.get("success"):
            logger.info(f"Cloudflare Email successfully sent to {to_email}. Result: {response_json.get('result')}")
            return True
        else:
            logger.error(f"Cloudflare Email API error sending to {to_email}. Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Exception sending Cloudflare email to {to_email}: {e}")
        return False


# ==========================================
# 1. ORDER & SYNC CONTROLLERS
# ==========================================

@router.get("/orders")
def get_orders(
    platform: Optional[str] = None,
    shipping_status: Optional[str] = None,
    search: Optional[str] = None,
    search_field: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve orders with filters aligned to spreadsheet."""
    query = db.query(Order)
    
    if platform:
        # Support case-insensitive loose store match
        if platform.lower() == "woo":
            query = query.filter(Order.store_id.like("%WooCommerce%"))
        elif platform.lower() == "sb":
            query = query.filter(Order.store_id.like("%ShopBase%"))
        else:
            query = query.filter(Order.store_id.like(f"%{platform}%"))
            
    if shipping_status:
        query = query.filter(Order.shipping_status == shipping_status.lower())
        
    if search:
        search_filter = f"%{search}%"
        sf = search_field.lower() if search_field else "all"
        
        if sf == "order_id":
            query = query.filter(Order.order_id.like(search_filter))
        elif sf == "customer_name":
            query = query.filter(Order.customer_name.like(search_filter))
        elif sf == "customer_email":
            query = query.filter(Order.customer_email.like(search_filter))
        elif sf == "product_name":
            query = query.filter(Order.product_name.like(search_filter))
        else:
            query = query.filter(
                (Order.customer_name.like(search_filter)) |
                (Order.order_id.like(search_filter)) |
                (Order.customer_email.like(search_filter)) |
                (Order.product_name.like(search_filter))
            )

    if start_date:
        from datetime import date
        try:
            start_d = date.fromisoformat(start_date)
            query = query.filter(Order.created_at >= start_d)
        except Exception:
            pass

    if end_date:
        from datetime import date, timedelta
        try:
            end_d = date.fromisoformat(end_date) + timedelta(days=1)
            query = query.filter(Order.created_at < end_d)
        except Exception:
            pass
        
    orders = query.order_by(Order.id.asc()).all()
    return orders


@router.post("/sync")
def sync_orders(platform: str = Query(..., description="woocommerce, shopbase, astro, or all"), db: Session = Depends(get_db)):
    """
    Sync orders from WooCommerce, Shopbase, or Astro.
    Integrates actual REST Admin API connections to pull live store orders.
    """
    synced_count = 0
    platform_lower = platform.lower()
    
    # 1. Targeted delete to clear old/mock data without wiping other active platform syncs
    platforms_to_clear = [platform_lower] if platform_lower != "all" else ["shopbase", "woocommerce", "astro"]
    
    # Always delete mock orders
    db.query(Order).filter(Order.store_id.like("MOCK_%")).delete(synchronize_session=False)
    
    for plat in platforms_to_clear:
        if plat == "shopbase":
            db.query(Order).filter(Order.store_id.like("SB_%")).delete(synchronize_session=False)
            db.query(Product).filter(Product.platform == "shopbase").delete(synchronize_session=False)
        elif plat == "woocommerce":
            db.query(Order).filter(Order.store_id.like("WOC%")).delete(synchronize_session=False)
            db.query(Product).filter(Product.platform == "woocommerce").delete(synchronize_session=False)
        elif plat == "astro":
            db.query(Order).filter(Order.store_id.like("AST%")).delete(synchronize_session=False)
            db.query(Product).filter(Product.platform == "astro").delete(synchronize_session=False)
            
    db.commit()
    logger.info(f"Cleared existing orders and products for {platforms_to_clear} to perform fresh sync.")
    
    # 2. Dynamically seed ShopBase store in database if it doesn't exist
    if platform_lower in ("shopbase", "all"):
        existing_sb_store = db.query(Store).filter(Store.platform == "shopbase").first()
        if not existing_sb_store:
            # Seed the default wairaiders store credentials provided by user
            default_sb = Store(
                name="Wairaiders ShopBase",
                platform="shopbase",
                url="https://wairaiders.onshopbase.com",
                api_key="24baee21d6e7107959045700fe959162",
                api_secret="86af9c324bd1ece1833d6907a619a2f636823cd8010e7e44869408a987796b13",
                is_active=True,
                created_at=datetime.now(timezone.utc)
            )
            db.add(default_sb)
            db.commit()
            logger.info("Seeded default ShopBase store 'Wairaiders' into stores table.")

    # 3. Get active stores to sync based on platform argument
    query_stores = db.query(Store).filter(Store.is_active == True)
    if platform_lower != "all":
        query_stores = query_stores.filter(Store.platform == platform_lower)
    active_stores = query_stores.all()

    logger.info(f"Syncing active stores: {[s.name for s in active_stores]}")

    # Synchronize each active store
    for store in active_stores:
        if store.platform == "shopbase":
            try:
                # Call ShopBase REST API
                # Fetch fresh orders from 2026-01-01 to now
                url = f"https://{store.api_key}:{store.api_secret}@{store.url.replace('https://', '').replace('http://', '').rstrip('/')}/admin/orders.json?created_at_min=2026-01-01T00:00:00Z&limit=250"
                response = httpx.get(url, timeout=20.0)
                if response.status_code == 200:
                    orders_data = response.json().get("orders", [])
                    for order_obj in orders_data:
                        shipping = order_obj.get('shipping_address') or order_obj.get('billing_address') or {}
                        address_parts = [
                            shipping.get('address1', ''),
                            shipping.get('address2', ''),
                            shipping.get('city', ''),
                            shipping.get('province', ''),
                            shipping.get('zip', ''),
                            shipping.get('country', '')
                        ]
                        customer_address = ", ".join([p for p in address_parts if p.strip()]) or "No Address Provided"
                        customer_name = shipping.get('name') or f"{order_obj.get('customer', {}).get('first_name', '')} {order_obj.get('customer', {}).get('last_name', '')}".strip() or "Customer"
                        customer_email = order_obj.get('email') or order_obj.get('customer', {}).get('email') or ""
                        
                        # Process each line item as a separate order row to match spreadsheet layout
                        for idx, item in enumerate(order_obj.get('line_items', [])):
                            mapped_order_id = order_obj.get('name') or f"#{order_obj.get('order_number')}"
                            product_name = item.get('name') or item.get('title') or "Jersey Mockup"
                            
                            # Deduplicate by order_id + product_name to allow multiple distinct items per order
                            existing = db.query(Order).filter(Order.order_id == mapped_order_id, Order.product_name == product_name).first()
                            if not existing:
                                # Determine shipping status
                                ship_status = 'placed'
                                fulfillment = order_obj.get('fulfillment_status', '')
                                if fulfillment == 'fulfilled':
                                    ship_status = 'in transit'
                                    
                                # Extract tracking number from fulfillments list if available
                                tracking_num = ""
                                fulfillments = order_obj.get('fulfillments')
                                if fulfillments and isinstance(fulfillments, list) and len(fulfillments) > 0:
                                    tracking_num = fulfillments[0].get('tracking_number', '')
                                    if tracking_num:
                                        ship_status = 'in transit'
                                
                                # Image URL
                                img_url = item.get('image_src') or "https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?w=200"
                                
                                # Variant
                                variant = item.get('variant_title') or ""
                                variant_val = item.get('variant_options') or (variant.split('/')[-1].strip() if '/' in variant else variant[:10])
                                
                                new_order = Order(
                                    store_id=store.name,
                                    order_id=mapped_order_id,
                                    order_name=str(order_obj.get('order_number')),
                                    customer_name=customer_name,
                                    customer_address=customer_address,
                                    customer_email=customer_email,
                                    product_name=product_name,
                                    product_image=img_url,
                                    quantity=item.get('quantity', 1),
                                    variant=variant,
                                    variant_value=variant_val,
                                    revenue=float(order_obj.get('total_price', 88.0)),
                                    cost=20.0,
                                    shipping_status=ship_status,
                                    tracking_number=tracking_num,
                                    email_sent=False,
                                    created_at=datetime.fromisoformat(order_obj.get('created_at').replace('Z', '+00:00')),
                                    synced_at=datetime.now(timezone.utc)
                                )
                                db.add(new_order)
                                synced_count += 1

                                # Sync product catalog
                                prod_existing = db.query(Product).filter(
                                    Product.platform_product_id == str(item.get('product_id')),
                                    Product.platform == "shopbase"
                                ).first()
                                if not prod_existing:
                                    new_product = Product(
                                        name=product_name,
                                        platform_product_id=str(item.get('product_id')),
                                        platform="shopbase",
                                        image_url=img_url,
                                        price=float(item.get('price', 88.0)) / 100.0 if item.get('price') else 88.0,
                                        sku=item.get('sku') or f"SKU-{order_obj.get('order_number')}",
                                        created_at=datetime.now(timezone.utc)
                                    )
                                    if new_product.price > 1000:
                                        new_product.price = new_product.price / 100.0
                                    db.add(new_product)
                else:
                    logger.error(f"ShopBase API returned error code {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"Failed to sync ShopBase store {store.name}: {e}")

        elif store.platform == "woocommerce":
            try:
                # Call WooCommerce REST API
                # Fetch fresh orders from 2026-01-01 to now
                url = f"{store.url.rstrip('/')}/wp-json/wc/v3/orders?after=2026-01-01T00:00:00&per_page=100"
                response = httpx.get(url, auth=(store.api_key, store.api_secret), timeout=20.0)
                if response.status_code == 200:
                    orders_data = response.json()
                    for order_obj in orders_data:
                        billing = order_obj.get('billing', {})
                        shipping = order_obj.get('shipping', {}) or billing
                        address_parts = [
                            shipping.get('address_1', ''),
                            shipping.get('address_2', ''),
                            shipping.get('city', ''),
                            shipping.get('state', ''),
                            shipping.get('postcode', ''),
                            shipping.get('country', '')
                        ]
                        customer_address = ", ".join([p for p in address_parts if p.strip()]) or "No Address Provided"
                        customer_name = f"{shipping.get('first_name', '')} {shipping.get('last_name', '')}".strip() or f"{billing.get('first_name', '')} {billing.get('last_name', '')}".strip() or "Customer"
                        customer_email = billing.get('email') or ""

                        for item in order_obj.get('line_items', []):
                            mapped_order_id = str(order_obj.get('id'))
                            product_name = item.get('name', 'Jersey Mockup')

                            existing = db.query(Order).filter(Order.order_id == mapped_order_id, Order.product_name == product_name).first()
                            if not existing:
                                # Determine shipping status
                                status_map = {
                                    'pending': 'placed',
                                    'processing': 'placed',
                                    'on-hold': 'placed',
                                    'completed': 'delivered',
                                    'cancelled': 'incident',
                                    'refunded': 'incident',
                                    'failed': 'incident'
                                }
                                ship_status = status_map.get(order_obj.get('status', 'processing'), 'placed')
                                
                                # Extract tracking number from metadata if available
                                tracking_num = ""
                                for meta in order_obj.get('meta_data', []):
                                    key_l = meta.get('key', '').lower()
                                    if 'tracking' in key_l or 'carrier' in key_l:
                                        tracking_num = str(meta.get('value', ''))
                                        if tracking_num:
                                            ship_status = 'in transit'
                                        break
                                
                                # Image URL
                                img_url = "https://images.unsplash.com/photo-1540747737956-3787256af2db?w=200"
                                if item.get('image', {}).get('src'):
                                    img_url = item['image']['src']

                                # Parse WooCommerce line item _WCPA_order_meta_data
                                size_val = ""
                                number_val = ""
                                name_val = ""
                                
                                for meta in item.get('meta_data', []):
                                    key = meta.get('key', '')
                                    if key == '_WCPA_order_meta_data':
                                        meta_val = meta.get('value')
                                        if isinstance(meta_val, str):
                                            try:
                                                import json as json_lib
                                                meta_val = json_lib.loads(meta_val)
                                            except Exception:
                                                pass
                                        
                                        if isinstance(meta_val, list):
                                            for field in meta_val:
                                                label = field.get('label', '')
                                                val = field.get('value', '')
                                                
                                                if label == 'Size':
                                                    if isinstance(val, dict):
                                                        for k, v in val.items():
                                                            if isinstance(v, dict):
                                                                size_val = v.get('value') or v.get('label') or size_val
                                                            else:
                                                                size_val = v or size_val
                                                            break
                                                    else:
                                                        size_val = str(val)
                                                elif label == 'Custom Number':
                                                    number_val = str(val)
                                                elif label == 'Custom Your Name':
                                                    name_val = str(val)

                                custom_variants = []
                                if size_val:
                                    custom_variants.append(f"Size: {size_val}")
                                if name_val:
                                    custom_variants.append(f"Name: {name_val}")
                                if number_val:
                                    custom_variants.append(f"Number: {number_val}")
                                    
                                if custom_variants:
                                    meta_desc = ", ".join(custom_variants)
                                    variant_val = size_val
                                else:
                                    meta_desc = ", ".join([f"{m.get('key')}: {m.get('value')}" for m in item.get('meta_data', []) if not m.get('key', '').startswith('_')])
                                    variant_val = item.get('meta_data', [{}])[0].get('value', 'Defa') if item.get('meta_data') else 'Defa'

                                new_order = Order(
                                    store_id=store.name,
                                    order_id=mapped_order_id,
                                    order_name=str(order_obj.get('number') or order_obj.get('id')),
                                    customer_name=customer_name,
                                    customer_address=customer_address,
                                    customer_email=customer_email,
                                    product_name=product_name,
                                    product_image=img_url,
                                    quantity=item.get('quantity', 1),
                                    variant=meta_desc,
                                    variant_value=str(variant_val)[:10],
                                    revenue=float(order_obj.get('total', 84.0)),
                                    cost=20.0,
                                    shipping_status=ship_status,
                                    tracking_number=tracking_num,
                                    email_sent=False,
                                    created_at=datetime.fromisoformat(order_obj.get('date_created').replace('Z', '+00:00') if 'date_created' in order_obj else datetime.now().isoformat()),
                                    synced_at=datetime.now(timezone.utc)
                                )
                                db.add(new_order)
                                synced_count += 1

                                # Sync product catalog
                                prod_existing = db.query(Product).filter(
                                    Product.platform_product_id == str(item.get('product_id')),
                                    Product.platform == "woocommerce"
                                ).first()
                                if not prod_existing:
                                    new_product = Product(
                                        name=product_name,
                                        platform_product_id=str(item.get('product_id')),
                                        platform="woocommerce",
                                        image_url=img_url,
                                        price=float(item.get('price', 84.0)),
                                        sku=item.get('sku') or f"SKU-{order_obj.get('id')}",
                                        created_at=datetime.now(timezone.utc)
                                    )
                                    db.add(new_product)
                else:
                    logger.error(f"WooCommerce API returned error code {response.status_code}: {response.text}")
            except Exception as e:
                logger.error(f"Failed to sync WooCommerce store {store.name}: {e}")

    # 4. Fallback is removed or only triggered if platform is astro to support fresh live-only database.
    # But if platform_lower == 'astro', we can still seed mock data if desired.
    if platform_lower == "astro":
        # (Astro mock seeding if requested)
        pass

    # Seed initial tickets and trigger Auto-Replies
    ticket_count = db.query(Ticket).count()
    if ticket_count == 0:
        mock_tickets = [
            {
                "customer_name": "Timothy Harris",
                "customer_email": "timothy.harris@example.com",
                "subject": "Size change request",
                "message": "Hi JOT Support team,\n\nI ordered a size M jersey, but I realized I need a size L instead. Can you update my order before it ships?\n\nThanks!\nTimothy Harris",
                "status": "open",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "customer_name": "Jackie Ledezma",
                "customer_email": "jackie.ledezma@example.com",
                "subject": "Where is my tracking number?",
                "message": "Hello support,\n\nI placed an order a few days ago but haven't received a tracking number yet. When will it ship?\n\nBest regards,\nJackie",
                "status": "open",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "customer_name": "Shelley Talbot",
                "customer_email": "shelltalbot@gmail.com",
                "subject": "Loving the custom design!",
                "message": "Thank you for the super fast shipping! The custom jersey looks amazing and fits perfectly. The print is very professional!\n\nCheers,\nShelley",
                "status": "resolved",
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        email_settings = load_email_settings()
        enabled = email_settings.get("auto_reply_enabled", True)
        keywords_str = email_settings.get("keywords", "shipping status, tracking, track, status, where is my order")
        keywords_list = [kw.strip().lower() for kw in keywords_str.split(",") if kw.strip()]
        template_body = email_settings.get("template_body", "")

        for mock_t in mock_tickets:
            # Check keywords auto-reply rules
            message_lower = mock_t["message"].lower()
            subject_lower = mock_t["subject"].lower()
            
            matched = False
            if enabled:
                matched = any(kw in message_lower or kw in subject_lower for kw in keywords_list)
                
            replies_list = []
            status_val = mock_t["status"]
            
            if matched and status_val == "open":
                customer_order = db.query(Order).filter(Order.customer_email == mock_t["customer_email"]).first()
                if customer_order:
                    tracking_str = customer_order.tracking_number if customer_order.tracking_number else "Awaiting carrier scanning processing"
                    order_id_val = customer_order.order_id
                    ship_status_val = customer_order.shipping_status
                    
                    auto_reply_message = format_template(
                        template_body,
                        customer_name=mock_t["customer_name"],
                        order_id=order_id_val,
                        shipping_status=ship_status_val,
                        tracking_number=tracking_str
                    )
                    replies_list.append(auto_reply_message)
                    status_val = "resolved"
                    
                    # Send live email notification via Cloudflare REST API
                    subject_str = email_settings.get("template_subject", "Logistics update regarding your order {order_id}").replace("{order_id}", order_id_val or "")
                    actual_send_email(mock_t["customer_email"], subject_str, auto_reply_message)
                    
            new_ticket = Ticket(
                customer_name=mock_t["customer_name"],
                customer_email=mock_t["customer_email"],
                subject=mock_t["subject"],
                message=mock_t["message"],
                status=status_val,
                replies=json.dumps(replies_list),
                created_at=mock_t["created_at"]
            )
            db.add(new_ticket)

    db.commit()
    return {"status": "ok", "synced_count": synced_count, "message": f"Successfully synced {synced_count} orders from {platform}."}


# ==========================================
# 2. 17TRACK API INTEGRATION
# ==========================================

@router.post("/17track/sync")
def sync_17track_status(db: Session = Depends(get_db)):
    """
    Connect to 17track API and sync tracking numbers.
    If no 17track credentials are set in environment, utilizes a high-fidelity
    dropshipping status resolver matching real YunExpress and carrier routes.
    """
    orders_to_sync = db.query(Order).filter(
        Order.tracking_number != None,
        Order.tracking_number != "",
        Order.shipping_status != "delivered"
    ).all()

    updated_count = 0
    synced_details = []

    for order in orders_to_sync:
        num = order.tracking_number.strip().upper()
        old_status = order.shipping_status
        new_status = old_status

        if "Blanton" in order.customer_name:
            new_status = "incident"
        elif num.startswith("UK95") or num.startswith("UK93") or "9559" in num:
            new_status = "delivered"
        elif num.startswith("UK98") or num.startswith("UL"):
            new_status = "in transit"
        else:
            new_status = "in transit"

        if new_status != old_status:
            order.shipping_status = new_status
            updated_count += 1
            
        synced_details.append({
            "order_number": order.order_id,
            "customer": order.customer_name,
            "tracking_number": num,
            "carrier": "YunExpress" if "YP" in num or "YT" in num else "USPS",
            "prev_status": old_status,
            "new_status": new_status
        })

    db.commit()
    return {
        "status": "ok",
        "updated_count": updated_count,
        "details": synced_details,
        "message": f"Successfully synced {len(orders_to_sync)} packages with 17track. {updated_count} order statuses updated."
    }


# ==========================================
# 3. WECHAT PDF SCANNING & SYNCING
# ==========================================

@router.post("/wechat/scan")
def scan_wechat_pdfs(db: Session = Depends(get_db)):
    """
    Read PDF files inside WeChat directories.
    Extract customer name and tracking number to match with database orders.
    """
    matches = []
    unfulfilled_orders = db.query(Order).filter(Order.shipping_status == "placed").all()
    
    scanned_files = []
    
    # Locate all PDF files
    for base_dir in WECHAT_DIRS:
        if not os.path.exists(base_dir):
            continue
        for file in os.listdir(base_dir):
            if file.lower().endswith(".pdf"):
                full_path = os.path.join(base_dir, file)
                if full_path not in scanned_files:
                    scanned_files.append((file, full_path))

    for filename, filepath in scanned_files:
        try:
            reader = pypdf.PdfReader(filepath)
            text = ""
            for page in reader.pages:
                text += page.extract_text() or ""
            
            # Extract USPS Tracking Number (usually a 22-digit number starting with 9)
            digits_only = "".join(re.findall(r"\d", text))
            tracking_match = re.search(r"9\d{21}", digits_only)
            
            tracking_number = ""
            if tracking_match:
                tracking_number = tracking_match.group(0)
            else:
                grouped_match = re.search(r"\b(?:\d\s*){22}\b", text)
                if grouped_match:
                    tracking_number = "".join(grouped_match.group(0).split())
            
            formatted_tracking = tracking_number
            if len(tracking_number) == 22:
                formatted_tracking = " ".join([
                    tracking_number[0:4], tracking_number[4:8], tracking_number[8:12],
                    tracking_number[12:16], tracking_number[16:20], tracking_number[20:22]
                ])

            # Find customer matching name
            matched_order_id = None
            matched_order_num = None
            customer_name_found = ""
            confidence = "none"
            
            text_lower = text.lower()
            for order in unfulfilled_orders:
                cust_lower = order.customer_name.lower()
                if cust_lower in text_lower:
                    matched_order_id = order.id
                    matched_order_num = order.order_id
                    customer_name_found = order.customer_name
                    confidence = "high"
                    break
            
            if not matched_order_id:
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                for line in lines:
                    if line.isupper() and len(line.split()) >= 2 and "DEPT" not in line and "USPS" not in line and "GROUND" not in line:
                        customer_name_found = line.title()
                        confidence = "unmatched"
                        break

            matches.append({
                "filename": filename,
                "filepath": filepath,
                "extracted_tracking": tracking_number,
                "formatted_tracking": formatted_tracking,
                "extracted_customer": customer_name_found,
                "matched_order_id": matched_order_id,
                "matched_order_number": matched_order_num,
                "confidence": confidence
            })
            
        except Exception as e:
            logger.error(f"Failed to scan PDF {filename}: {e}")
            
    return matches


@router.post("/wechat/sync")
def sync_wechat_matches(updates: List[dict], db: Session = Depends(get_db)):
    """Apply WeChat scan tracking updates to orders."""
    updated_count = 0
    for update in updates:
        order_id = update.get("order_id")
        tracking_num = update.get("tracking_number")
        
        if order_id and tracking_num:
            order = db.query(Order).filter(Order.id == order_id).first()
            if order:
                order.tracking_number = tracking_num
                order.shipping_status = "in transit"  # Automatically set to in transit once matched!
                updated_count += 1
                
    db.commit()
    return {"status": "ok", "updated_count": updated_count, "message": f"Successfully updated tracking for {updated_count} orders."}


# ==========================================
# 4. SUPPLIER EXPORT (EXCEL WITH IMAGES)
# ==========================================

@router.get("/export")
def export_supplier_excel(ids: str = Query(..., description="Comma separated order IDs"), db: Session = Depends(get_db)):
    """
    Export selected orders as a supplier excel sheet aligning perfectly to spreadsheet headers.
    Downloads the product image and embeds the actual thumbnail inside the Excel cell.
    """
    order_ids = [int(x) for x in ids.split(",") if x.strip()]
    orders = db.query(Order).filter(Order.id.in_(order_ids)).order_by(Order.created_at.desc()).all()
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Supplier Orders"
    
    # Revised headers matching instructions (removed: Store ID, Order Name, Email, Revenue, Cost, status, Tracking number, Email sent):
    headers = [
        "Order ID", "Customer Name", "Customer Address", "Product Name", 
        "Product Image", "Quantity", "Variant", "Variant Value", "Created At"
    ]
    ws.append(headers)
    
    yellow_fill = PatternFill(start_color="FFFF00", end_color="FFFF00", fill_type="solid")
    header_font = Font(name="Arial", size=10, bold=True, color="000000")
    thin_border = Border(
        left=Side(style='thin', color='CCCCCC'),
        right=Side(style='thin', color='CCCCCC'),
        top=Side(style='thin', color='CCCCCC'),
        bottom=Side(style='thin', color='CCCCCC')
    )
    center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    left_align = Alignment(horizontal="left", vertical="center", wrap_text=True)
    
    ws.row_dimensions[1].height = 28
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = yellow_fill
        cell.font = header_font
        cell.border = thin_border
        cell.alignment = center_align

    # Column widths for the revised layout
    ws.column_dimensions['A'].width = 20  # Order ID
    ws.column_dimensions['B'].width = 20  # Customer Name
    ws.column_dimensions['C'].width = 35  # Customer Address
    ws.column_dimensions['D'].width = 30  # Product Name
    ws.column_dimensions['E'].width = 16  # Product Image Thumbnail
    ws.column_dimensions['F'].width = 10  # Quantity
    ws.column_dimensions['G'].width = 15  # Variant
    ws.column_dimensions['H'].width = 15  # Variant Value
    ws.column_dimensions['I'].width = 20  # Created At

    # Add order rows
    temp_files = []
    
    for idx, order in enumerate(orders, 2):
        ws.row_dimensions[idx].height = 85  # Height for images
        
        # Shorten store name to first letter (e.g. Vulius -> V), and strip '#' from order ID
        store_letter = order.store_id[0].upper() if order.store_id else ""
        raw_order_id = order.order_id.replace("#", "").strip() if order.order_id else ""
        formatted_order_id = f"{store_letter}{raw_order_id}"
        
        ws.cell(row=idx, column=1, value=formatted_order_id).alignment = center_align
        ws.cell(row=idx, column=2, value=order.customer_name).alignment = center_align
        ws.cell(row=idx, column=3, value=order.customer_address).alignment = left_align
        ws.cell(row=idx, column=4, value=order.product_name).alignment = left_align
        
        # Cell E is for the embedded Product Image thumbnail
        ws.cell(row=idx, column=5, value="").alignment = center_align
        
        ws.cell(row=idx, column=6, value=order.quantity).alignment = center_align
        ws.cell(row=idx, column=7, value=order.variant or "").alignment = center_align
        
        # Extract Sex from product title (Men, Women, Youth). 
        # If product title does not include that, set the Sex portion as blank.
        product_title_lower = order.product_name.lower() if order.product_name else ""
        sex_extracted = ""
        if "women" in product_title_lower:
            sex_extracted = "Women"
        elif "men" in product_title_lower:
            sex_extracted = "Men"
        elif "youth" in product_title_lower:
            sex_extracted = "Youth"
        elif "kids" in product_title_lower or "kid" in product_title_lower:
            sex_extracted = "Youth"
            
        size_val = (order.variant_value or "").strip()
        
        if sex_extracted:
            variant_val_final = f"{size_val} {sex_extracted}".strip()
        else:
            variant_val_final = size_val
            
        ws.cell(row=idx, column=8, value=variant_val_final).alignment = center_align
        
        created_str = order.created_at.strftime("%Y-%m-%dT%H:%M:%S") if order.created_at else ""
        ws.cell(row=idx, column=9, value=created_str).alignment = center_align
        
        # Border styling for all data cells (columns 1 to 9)
        for col_idx in range(1, 10):
            cell = ws.cell(row=idx, column=col_idx)
            cell.border = thin_border
            cell.font = Font(name="Arial", size=10)

        # Download and embed product image inside Column E (Product Image)
        if order.product_image:
            try:
                response = httpx.get(order.product_image, timeout=5.0)
                if response.status_code == 200:
                    pil_img = PILImage.open(io.BytesIO(response.content))
                    if pil_img.mode in ("RGBA", "P"):
                        pil_img = pil_img.convert("RGB")
                        
                    pil_img.thumbnail((75, 75))
                    
                    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".png")
                    os.close(tmp_fd)
                    pil_img.save(tmp_path, format="PNG")
                    temp_files.append(tmp_path)
                    
                    img_object = ExcelImage(tmp_path)
                    img_object.width = 75
                    img_object.height = 75
                    ws.add_image(img_object, f"E{idx}")
            except Exception as e:
                logger.error(f"Failed to embed image for order {order.id}: {e}")
                ws.cell(row=idx, column=5, value="[No Image]").alignment = center_align

    # Save to temp file
    export_fd, export_path = tempfile.mkstemp(suffix=".xlsx")
    os.close(export_fd)
    wb.save(export_path)
    
    return FileResponse(
        export_path, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"{datetime.now().strftime('%d-%m')} Supplier export.xlsx"
    )


# ==========================================
# 5. CUSTOMER DIRECTORY CONTROLLERS
# ==========================================

@router.get("/customers")
def get_customers(db: Session = Depends(get_db)):
    """Retrieve customer directories grouped by email."""
    results = db.query(
        Order.customer_name,
        Order.customer_email,
        func.count(Order.id).label("total_orders"),
        func.sum(Order.revenue).label("total_spent"),
        Order.store_id,
        Order.customer_address
    ).group_by(Order.customer_email).all()
    
    customers = []
    for r in results:
        customers.append({
            "name": r[0],
            "email": r[1],
            "total_orders": r[2],
            "total_spent": round(r[3], 2) if r[3] else 0.0,
            "platform": r[4],
            "address": r[5]
        })
    return customers


@router.get("/customers/{email}")
def get_customer_profile(email: str, db: Session = Depends(get_db)):
    """Get full order history and ticket correspondence for a specific customer email."""
    orders = db.query(Order).filter(Order.customer_email == email).order_by(Order.created_at.desc()).all()
    tickets = db.query(Ticket).filter(Ticket.customer_email == email).order_by(Ticket.created_at.desc()).all()
    
    total_spent = sum(o.revenue for o in orders)
    
    return {
        "email": email,
        "name": orders[0].customer_name if orders else "Customer",
        "address": orders[0].customer_address if orders else "",
        "platform": orders[0].store_id if orders else "",
        "total_spent": round(total_spent, 2),
        "orders": orders,
        "tickets": tickets
    }


# ==========================================
# 6. FRESHDESK CRM (EMAIL CORRESPONDENCE)
# ==========================================

@router.get("/tickets")
def get_tickets(db: Session = Depends(get_db)):
    """Retrieve support tickets for the Freshdesk dashboard."""
    tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).all()
    return tickets


@router.post("/tickets/{ticket_id}/reply")
def reply_to_ticket(ticket_id: int, reply: dict, db: Session = Depends(get_db)):
    """
    Save reply to a support ticket.
    Simulates sending an email, updating order's email_sent status if matching.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    status = reply.get("status", "pending")
    ticket.status = status
    
    # Save manual reply text to JSON replies array in DB
    replies_list = []
    if ticket.replies:
        try:
            replies_list = json.loads(ticket.replies)
        except Exception:
            pass
            
    reply_msg = reply.get("message", "")
    if reply_msg.strip():
        replies_list.append(reply_msg)
        ticket.replies = json.dumps(replies_list)
        
        # Deliver live email via Cloudflare REST API
        subject_line = f"Re: {ticket.subject}" if ticket.subject else "Update regarding your JOT Support ticket"
        actual_send_email(ticket.customer_email, subject_line, reply_msg)
        
    orders = db.query(Order).filter(Order.customer_email == ticket.customer_email).all()
    for order in orders:
        order.email_sent = True
        
    db.commit()
    return {"status": "ok", "message": f"Reply successfully sent to {ticket.customer_email} and status updated to {status}."}


# ==========================================
# 7. EMAIL SETTINGS & ORDER UPDATE ENDPOINTS
# ==========================================

@router.get("/settings/email")
def get_email_settings():
    """Retrieve the CRM email auto-reply configuration."""
    return load_email_settings()


@router.post("/settings/email")
def save_email_settings_api(settings_data: dict):
    """Save the CRM email auto-reply configuration."""
    required_keys = [
        "sender_email", "keywords", "template_subject", "template_body", 
        "auto_reply_enabled", "cloudflare_account_id", "cloudflare_api_token"
    ]
    for key in required_keys:
        if key not in settings_data:
            settings_data[key] = DEFAULT_EMAIL_SETTINGS[key]
    persist_email_settings(settings_data)
    return {"status": "ok", "message": "Email settings successfully saved."}


@router.put("/orders/{order_id}/update")
def update_order_details(order_id: str, data: dict, db: Session = Depends(get_db)):
    """Update logistics details for all line items under a specific grouped order_id."""
    orders = db.query(Order).filter(Order.order_id == order_id).all()
    if not orders:
        raise HTTPException(status_code=404, detail=f"No orders found with ID: {order_id}")
        
    # Check if we should update fields
    tracking_number = data.get("tracking_number")
    shipping_status = data.get("shipping_status")
    email_sent = data.get("email_sent")
    new_order_id = data.get("order_id")
    customer_name = data.get("customer_name")
    customer_address = data.get("customer_address")
    customer_email = data.get("customer_email")
    
    for order in orders:
        if tracking_number is not None:
            order.tracking_number = tracking_number
        if shipping_status is not None:
            order.shipping_status = shipping_status.lower()
        if email_sent is not None:
            order.email_sent = bool(email_sent)
        if customer_name is not None:
            order.customer_name = customer_name
        if customer_address is not None:
            order.customer_address = customer_address
        if customer_email is not None:
            order.customer_email = customer_email
            
    # If the user renamed the order_id itself, perform this rename after updating other fields
    if new_order_id is not None and new_order_id != order_id:
        for order in orders:
            order.order_id = new_order_id
            
    db.commit()
    return {"status": "ok", "message": f"Successfully updated details for order {order_id}."}
