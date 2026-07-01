from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import razorpay
import logging
import uuid
import bcrypt
import jwt
import requests
import hmac
import hashlib
import requests
import secrets
import asyncio
import smtplib
import resend
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File, BackgroundTasks
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# -----------------------------
# Config
# -----------------------------
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'change-me')
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'prithiviraj0114@gmail.com').lower()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@2026')
ADMIN_MOBILE = os.environ.get('ADMIN_MOBILE', '97919757412')
CASHFREE_APP_ID = os.environ.get('CASHFREE_APP_ID', '')
CASHFREE_SECRET_KEY = os.environ.get('CASHFREE_SECRET_KEY', '')
CASHFREE_ENV = os.environ.get('CASHFREE_ENV', 'sandbox')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
APP_NAME = os.environ.get('APP_NAME', 'ayutree')
SMTP_USERNAME = os.environ.get('SMTP_USERNAME', 'prithiviraj0114@gmail.com')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', f'Ayutree <{SMTP_USERNAME}>')
FRONTEND_URL_FOR_LINKS = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', os.environ.get('RESEND_KEY', ''))
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_storage_key: Optional[str] = None

client = None
db = None

def _is_mongo_running(url: str) -> bool:
    try:
        import pymongo
        client = pymongo.MongoClient(url, serverSelectionTimeoutMS=1500)
        client.admin.command('ismaster')
        client.close()
        return True
    except Exception as e:
        import logging
        logging.getLogger("ayutree").warning(f"MongoDB check failed, falling back to mock database: {e}")
        return False

if _is_mongo_running(MONGO_URL):
    print("Connecting to live MongoDB...")
    client = AsyncIOMotorClient(MONGO_URL)
else:
    print("MongoDB is not running. Falling back to Mock JSON database...")
    from mock_db import MockAsyncIOMotorClient
    client = MockAsyncIOMotorClient(MONGO_URL)

db = client[DB_NAME]

cashfree_ready = bool(CASHFREE_APP_ID and CASHFREE_SECRET_KEY and not CASHFREE_APP_ID.endswith('placeholder'))
cashfree_base_url = "https://sandbox.cashfree.com/pg" if CASHFREE_ENV == "sandbox" else "https://api.cashfree.com/pg"

app = FastAPI(title="Ayutree API")
api = APIRouter(prefix="/api")


# -----------------------------
# Helpers - Auth
# -----------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=7 * 24 * 60 * 60,
        path="/",
    )


# -----------------------------
# Helpers - Object Storage
# -----------------------------
def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_LLM_KEY:
        return None
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logging.getLogger("ayutree").warning(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = None
    try:
        key = init_storage()
    except Exception:
        pass

    if key:
        try:
            r = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=120,
            )
            if r.status_code == 403:
                # storage key may have expired, refresh once
                global _storage_key
                _storage_key = None
                key = init_storage()
                r = requests.put(
                    f"{STORAGE_URL}/objects/{path}",
                    headers={"X-Storage-Key": key, "Content-Type": content_type},
                    data=data,
                    timeout=120,
                )
            r.raise_for_status()
            return r.json()
        except Exception as e:
            logging.getLogger("ayutree").warning(f"Storage upload failed, using local fallback: {e}")

    # Fallback to local storage
    upload_dir = Path(os.environ.get("UPLOAD_DIR_PATH", str(ROOT_DIR / "uploads")))
    local_file = upload_dir / path
    local_file.parent.mkdir(parents=True, exist_ok=True)
    local_file.write_bytes(data)
    return {
        "path": path,
        "size": len(data),
        "content_type": content_type,
        "storage": "local"
    }


def get_object(path: str) -> tuple:
    import mimetypes
    # Try local storage first
    upload_dir = Path(os.environ.get("UPLOAD_DIR_PATH", str(ROOT_DIR / "uploads")))
    local_file = upload_dir / path
    if local_file.is_file():
        content = local_file.read_bytes()
        ctype, _ = mimetypes.guess_type(str(local_file))
        if not ctype:
            ctype = "application/octet-stream"
        return content, ctype

    # Fallback to object storage
    key = init_storage()
    if not key:
        raise HTTPException(status_code=404, detail="File not found locally and object storage unavailable")
    try:
        r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
        r.raise_for_status()
        return r.content, r.headers.get("Content-Type", "application/octet-stream")
    except requests.exceptions.HTTPError as he:
        status_code = he.response.status_code if he.response is not None else 500
        raise HTTPException(status_code=status_code, detail=f"Failed to fetch from object storage: {he}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error accessing object storage: {e}")


# -----------------------------
# Helpers - Email
# -----------------------------
async def send_email(to: str, subject: str, html: str) -> bool:
    # 1. Try sending via Resend first if key is configured
    if RESEND_API_KEY:
        try:
            def _send_resend():
                resend.Emails.send({
                    "from": SENDER_EMAIL,
                    "to": to,
                    "subject": subject,
                    "html": html,
                })
            await asyncio.to_thread(_send_resend)
            return True
        except Exception as e:
            logging.getLogger("ayutree").warning(f"Resend email send failed, trying SMTP fallback: {e}")

    # 2. Try sending via SMTP (fallback)
    if not SMTP_PASSWORD:
        logging.getLogger("ayutree").info(f"[email-skipped-no-password] to={to} subject={subject}")
        return False
    try:
        def _send():
            msg = EmailMessage()
            msg.set_content("Please enable HTML to view this email.")
            msg.add_alternative(html, subtype='html')
            msg['Subject'] = subject
            msg['From'] = SENDER_EMAIL
            msg['To'] = to

            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.send_message(msg)

        await asyncio.to_thread(_send)
        return True
    except Exception as e:
        logging.getLogger("ayutree").error(f"Email send failed: {e}")
        return False


async def send_multiple_emails(tasks: List[dict]):
    for task in tasks:
        await send_email(task["to"], task["subject"], task["html"])



def _email_layout(title: str, body_html: str) -> str:
    return f"""
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9F6F0;font-family:Helvetica,Arial,sans-serif;padding:32px 0;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #E8E1D5;">
      <tr><td style="background:#1A3B32;padding:24px 32px;color:#C2A878;">
        <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;">Ayutree</div>
        <div style="font-size:22px;font-family:Georgia,serif;color:#F9F6F0;margin-top:4px;">{title}</div>
      </td></tr>
      <tr><td style="padding:28px 32px;color:#12221C;font-size:14px;line-height:22px;">
        {body_html}
      </td></tr>
      <tr><td style="background:#F3EFE6;padding:18px 32px;color:#5C6B64;font-size:12px;text-align:center;">
        Empowered by Nature, Enhanced by Ayurveda — Ayutree
      </td></tr>
    </table>
  </td></tr>
</table>
"""


def _order_items_html(items: List[dict]) -> str:
    return "".join([
        f"<tr><td style='padding:8px 0;color:#5C6B64;'>{it['name']} × {it['qty']}</td>"
        f"<td style='padding:8px 0;text-align:right;color:#1A3B32;'>₹{int(it['total'])}</td></tr>"
        for it in items
    ])


def _customer_order_email_body(order: dict) -> str:
    shipping_address = order['address']
    items_html = _order_items_html(order['items'])
    discount_row = ""
    if order.get('discount', 0):
        discount_row = f"<tr><td style='padding:8px 0;'><b>Discount</b></td><td style='padding:8px 0;text-align:right;'>-₹{int(order['discount'])}</td></tr>"
    
    pay_id = order.get('cf_payment_id') or order.get('razorpay_payment_id') or ""
    pay_id_html = f"<br/><b>Payment ID:</b> {pay_id}" if pay_id else ""
    
    return _email_layout(
        f"Order confirmed — #{order['order_id']}",
        f"""<p>Hello {shipping_address.get('full_name', 'Customer')},</p>
            <p>Thank you for your purchase! Your order has been received successfully.</p>
            <table width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #E8E1D5;border-bottom:1px solid #E8E1D5;margin:16px 0;font-size:14px;'>
              {items_html}
              <tr><td style='padding:8px 0;'><b>Subtotal</b></td><td style='padding:8px 0;text-align:right;'>₹{int(order['subtotal'])}</td></tr>
              <tr><td style='padding:8px 0;'><b>Shipping</b></td><td style='padding:8px 0;text-align:right;'>₹{int(order['shipping'])}</td></tr>
              <tr><td style='padding:8px 0;'><b>Tax</b></td><td style='padding:8px 0;text-align:right;'>₹{int(order['tax'])}</td></tr>
              {discount_row}
              <tr><td style='padding:8px 0;'><b>Total</b></td><td style='padding:8px 0;text-align:right;'><b>₹{int(order['total'])}</b></td></tr>
            </table>
            <p><b>Shipping to:</b><br/>{shipping_address.get('line1', '')}, {shipping_address.get('city', '')}, {shipping_address.get('state', '')} {shipping_address.get('pincode', '')}</p>
            <p><b>Mobile:</b> {shipping_address.get('phone', '')}<br/><b>Email:</b> {order.get('user_email')}</p>
            <p style='color:#5C6B64;font-size:12px;'>Payment method: {order.get('payment_method', '').upper()}{pay_id_html}</p>""",
    )


def _admin_order_email_body(order: dict) -> str:
    shipping_address = order['address']
    items_html = _order_items_html(order['items'])
    
    pay_id = order.get('cf_payment_id') or order.get('razorpay_payment_id') or ""
    pay_id_html = f"<br/><b>Payment ID:</b> {pay_id}" if pay_id else ""
    
    return _email_layout(
        f"New order received — #{order['order_id']}",
        f"""<p>A new order has been placed by {shipping_address.get('full_name', 'Customer')}.</p>
            <p><b>Customer email:</b> {order.get('user_email')}<br/><b>Mobile:</b> {shipping_address.get('phone', '')}</p>
            <table width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #E8E1D5;border-bottom:1px solid #E8E1D5;margin:16px 0;font-size:14px;'>
              {items_html}
            </table>
            <p><b>Order total:</b> ₹{int(order['total'])}<br/><b>Payment method:</b> {order.get('payment_method', '').upper()}{pay_id_html}</p>
            <p><b>Delivery address:</b><br/>{shipping_address.get('line1', '')}, {shipping_address.get('city', '')}, {shipping_address.get('state', '')} {shipping_address.get('pincode', '')}</p>""",
    )


# -----------------------------
# Pydantic Models
# -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleNativeIn(BaseModel):
    access_token: str


class ContactIn(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


class ProductIn(BaseModel):
    name: str
    category: str
    price: float
    mrp: Optional[float] = None
    description: str = ""
    short_description: str = ""
    ingredients: str = ""
    benefits: List[str] = []
    image: str = ""
    stock: int = 100
    sku: Optional[str] = None
    featured: bool = False


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    mrp: Optional[float] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    ingredients: Optional[str] = None
    benefits: Optional[List[str]] = None
    image: Optional[str] = None
    stock: Optional[int] = None
    featured: Optional[bool] = None


class CartItemIn(BaseModel):
    product_id: str
    qty: int = 1


class AddressIn(BaseModel):
    full_name: str
    phone: str = Field(pattern=r"^\d{10}$")
    line1: str
    line2: str = ""
    city: str
    state: str
    pincode: str = Field(pattern=r"^\d{6}$")
    country: str = "India"


class CheckoutIn(BaseModel):
    address: AddressIn
    payment_method: str = "cod"  # cod | cashfree
    coupon_code: Optional[str] = None


class PaymentVerifyIn(BaseModel):
    order_id: str
    cf_order_id: str
    cf_payment_id: str


class RazorpayVerifyIn(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ReviewIn(BaseModel):
    product_id: str
    rating: int
    comment: str = ""


class CategoryIn(BaseModel):
    slug: str
    name: str
    image: str = ""


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    image: Optional[str] = None


class CouponIn(BaseModel):
    code: str
    type: str = "percent"  # percent | flat
    value: float
    min_order: float = 0
    max_discount: Optional[float] = None
    expires_at: Optional[str] = None
    active: bool = True
    usage_limit: Optional[int] = None
    description: str = ""


class CouponUpdate(BaseModel):
    type: Optional[str] = None
    value: Optional[float] = None
    min_order: Optional[float] = None
    max_discount: Optional[float] = None
    expires_at: Optional[str] = None
    active: Optional[bool] = None
    usage_limit: Optional[int] = None
    description: Optional[str] = None


class CouponValidateIn(BaseModel):
    code: str
    subtotal: float


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    password: str


# -----------------------------
# Auth Endpoints
# -----------------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": user_id,
        "email": email,
        "name": payload.name,
        "password_hash": hash_password(payload.password),
        "role": "customer",
        "auth_provider": "local",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email, "customer")
    set_auth_cookie(response, token)
    return {"user_id": user_id, "email": email, "name": payload.name, "role": "customer", "token": token}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(user["user_id"], user["email"], user.get("role", "customer"))
    set_auth_cookie(response, token)
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "customer"),
        "token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api.post("/auth/google/native")
async def google_native(payload: GoogleNativeIn, response: Response):
    """Verify native Google access token and create our own JWT."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {payload.access_token}"},
                timeout=10,
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        data = r.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Google Auth service unreachable: {str(e)}")

    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    if not email:
        raise HTTPException(status_code=400, detail="No email returned from Google")

    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "customer",
            "auth_provider": "google",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user)
        user.pop("_id", None)
    else:
        await db.users.update_one({"email": email}, {"$set": {"name": name, "picture": picture}})

    token = create_access_token(user["user_id"], email, user.get("role", "customer"))
    set_auth_cookie(response, token)
    return {
        "user_id": user["user_id"],
        "email": email,
        "name": name,
        "picture": picture,
        "role": user.get("role", "customer"),
        "token": token,
    }


# -----------------------------
# Products
# -----------------------------
@api.get("/products")
async def list_products(
    category: Optional[str] = None,
    q: Optional[str] = None,
    featured: Optional[bool] = None,
    limit: int = 100,
):
    query: dict = {}
    if category and category != "all":
        query["category"] = category
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if featured is not None:
        query["featured"] = featured
    items = await db.products.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return items


@api.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Not found")
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(50)
    p["reviews"] = reviews
    return p


@api.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(50)
    return cats


@api.post("/admin/products")
async def admin_create_product(payload: ProductIn, admin: dict = Depends(get_admin_user)):
    pid = f"prod_{uuid.uuid4().hex[:10]}"
    doc = payload.model_dump()
    doc["product_id"] = pid
    doc["mrp"] = doc.get("mrp") or doc["price"]
    doc["sku"] = doc.get("sku") or pid.upper()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/products/{product_id}")
async def admin_update_product(product_id: str, payload: ProductUpdate, admin: dict = Depends(get_admin_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.products.update_one({"product_id": product_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    return p


@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin: dict = Depends(get_admin_user)):
    await db.products.delete_one({"product_id": product_id})
    return {"ok": True}


# -----------------------------
# Cart
# -----------------------------
@api.get("/cart")
async def get_cart(user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["user_id"]}, {"_id": 0})
    if not cart:
        return {"user_id": user["user_id"], "items": []}
    # enrich with product info
    items = []
    for it in cart.get("items", []):
        p = await db.products.find_one({"product_id": it["product_id"]}, {"_id": 0})
        if p:
            items.append({**it, "product": p})
    return {"user_id": user["user_id"], "items": items}


@api.post("/cart/add")
async def cart_add(payload: CartItemIn, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if not cart:
        await db.carts.insert_one({"user_id": user["user_id"], "items": [payload.model_dump()]})
    else:
        items = cart.get("items", [])
        found = False
        for it in items:
            if it["product_id"] == payload.product_id:
                it["qty"] += payload.qty
                found = True
                break
        if not found:
            items.append(payload.model_dump())
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": items}})
    return {"ok": True}


@api.post("/cart/update")
async def cart_update(payload: CartItemIn, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    items = cart.get("items", []) if cart else []
    if payload.qty <= 0:
        items = [it for it in items if it["product_id"] != payload.product_id]
    else:
        found = False
        for it in items:
            if it["product_id"] == payload.product_id:
                it["qty"] = payload.qty
                found = True
        if not found:
            items.append(payload.model_dump())
    await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True}


@api.delete("/cart/{product_id}")
async def cart_remove(product_id: str, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    items = [it for it in (cart.get("items", []) if cart else []) if it["product_id"] != product_id]
    await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": items}}, upsert=True)
    return {"ok": True}


# -----------------------------
# Wishlist
# -----------------------------
@api.get("/wishlist")
async def get_wishlist(user: dict = Depends(get_current_user)):
    w = await db.wishlists.find_one({"user_id": user["user_id"]}, {"_id": 0})
    items = []
    for pid in (w.get("product_ids", []) if w else []):
        p = await db.products.find_one({"product_id": pid}, {"_id": 0})
        if p:
            items.append(p)
    return items


@api.post("/wishlist/toggle/{product_id}")
async def wishlist_toggle(product_id: str, user: dict = Depends(get_current_user)):
    w = await db.wishlists.find_one({"user_id": user["user_id"]})
    ids = w.get("product_ids", []) if w else []
    if product_id in ids:
        ids.remove(product_id)
        added = False
    else:
        ids.append(product_id)
        added = True
    await db.wishlists.update_one({"user_id": user["user_id"]}, {"$set": {"product_ids": ids}}, upsert=True)
    return {"added": added, "product_ids": ids}


# -----------------------------
# Orders + Payments
# -----------------------------
@api.post("/checkout")
async def checkout(payload: CheckoutIn, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["user_id"]})
    if not cart or not cart.get("items"):
        raise HTTPException(400, "Cart empty")
    items_full = []
    subtotal = 0.0
    for it in cart["items"]:
        p = await db.products.find_one({"product_id": it["product_id"]}, {"_id": 0})
        if not p:
            continue
        line = {
            "product_id": p["product_id"],
            "name": p["name"],
            "price": p["price"],
            "qty": it["qty"],
            "image": p.get("image", ""),
            "total": p["price"] * it["qty"],
        }
        subtotal += line["total"]
        items_full.append(line)
    shipping = 0 if subtotal >= 499 else 49
    tax = round(subtotal * 0.05, 2)

    # Apply coupon (if provided)
    discount = 0.0
    coupon_doc = None
    if payload.coupon_code:
        coupon_doc = await _resolve_coupon(payload.coupon_code, subtotal)
        discount = _coupon_discount(coupon_doc, subtotal)

    total = round(subtotal + shipping + tax - discount, 2)
    if total < 0:
        total = 0.0

    order_id = f"AYU{datetime.now().strftime('%y%m%d')}{uuid.uuid4().hex[:6].upper()}"
    order_doc = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "user_email": user["email"],
        "items": items_full,
        "subtotal": subtotal,
        "shipping": shipping,
        "tax": tax,
        "discount": discount,
        "coupon_code": coupon_doc["code"] if coupon_doc else None,
        "total": total,
        "address": payload.address.model_dump(),
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "status": "placed" if payload.payment_method == "cod" else "awaiting_payment",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    cf_order = None
    payment_session_id = None
    razorpay_order_id = None
    if payload.payment_method == "cashfree":
        if not cashfree_ready:
            # Fallback: simulate order so checkout flow still works
            payment_session_id = f"session_test_{uuid.uuid4().hex[:15]}"
            cf_order = {"order_id": order_id, "order_amount": total, "order_currency": "INR"}
        else:
            # Create order via Cashfree REST API
            headers = {
                "x-client-id": CASHFREE_APP_ID,
                "x-client-secret": CASHFREE_SECRET_KEY,
                "x-api-version": "2023-08-01",
                "Content-Type": "application/json"
            }
            cf_payload = {
                "order_id": order_id,
                "order_amount": total,
                "order_currency": "INR",
                "customer_details": {
                    "customer_id": user["user_id"],
                    "customer_email": user["email"],
                    "customer_phone": payload.address.phone or "9999999999"
                },
                "order_meta": {
                    "return_url": f"{FRONTEND_URL_FOR_LINKS}/profile?order={{order_id}}"
                }
            }
            try:
                r = requests.post(f"{cashfree_base_url}/orders", json=cf_payload, headers=headers)
                r.raise_for_status()
                data = r.json()
                payment_session_id = data.get("payment_session_id")
                cf_order = data
            except Exception as e:
                logging.getLogger("ayutree").error(f"Cashfree order creation failed: {e}")
                raise HTTPException(502, "Payment gateway unavailable")
            
        order_doc["cf_order_id"] = order_id
        order_doc["cf_payment_session_id"] = payment_session_id
    elif payload.payment_method == "razorpay":
        if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
            logging.getLogger("ayutree").error("Razorpay credentials are missing")
            raise HTTPException(status_code=500, detail="Razorpay gateway credentials missing")
        try:
            client_rp = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
            amount_paise = int(total * 100)
            if amount_paise < 100:
                amount_paise = 100  # Minimum amount 100 paise
            rp_order = client_rp.order.create(data={
                "amount": amount_paise,
                "currency": "INR",
                "receipt": order_id
            })
            razorpay_order_id = rp_order.get("id")
        except Exception as e:
            logging.getLogger("ayutree").error(f"Razorpay order creation failed: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create Razorpay order: {str(e)}")
        
        order_doc["razorpay_order_id"] = razorpay_order_id

    await db.orders.insert_one(order_doc)
    if coupon_doc:
        await db.coupons.update_one({"code": coupon_doc["code"]}, {"$inc": {"used_count": 1}})

    if payload.payment_method == "cod":
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": []}})
        background_tasks.add_task(send_multiple_emails, [
            {"to": user["email"], "subject": f"Ayutree order confirmed — #{order_id}", "html": _customer_order_email_body(order_doc)},
            {"to": ADMIN_EMAIL, "subject": f"New Ayutree order — #{order_id}", "html": _admin_order_email_body(order_doc)}
        ])
    else:
        background_tasks.add_task(send_email, ADMIN_EMAIL, f"New Ayutree order received — #{order_id}", _admin_order_email_body(order_doc))

    return {
        "order_id": order_id,
        "total": total,
        "cashfree": cf_order,
        "payment_session_id": payment_session_id,
        "is_test_mode": not cashfree_ready,
        "razorpay_order_id": razorpay_order_id,
        "razorpay_key_id": RAZORPAY_KEY_ID
    }


@api.post("/payments/verify")
async def verify_payment(payload: PaymentVerifyIn, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": payload.order_id}, {"_id": 0})
    if not order or order["user_id"] != user["user_id"]:
        raise HTTPException(404, "Order not found")

    # Skip strict verification when in placeholder/test mode
    verified = True
    if cashfree_ready and "session_test_" not in order.get("cf_payment_session_id", ""):
        headers = {
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET_KEY,
            "x-api-version": "2023-08-01"
        }
        try:
            r = requests.get(f"{cashfree_base_url}/orders/{payload.order_id}/payments", headers=headers)
            r.raise_for_status()
            payments = r.json()
            # Find if any payment for this order was successful
            verified = any(p.get("payment_status") == "SUCCESS" for p in payments)
        except Exception:
            verified = False

    if not verified:
        await db.orders.update_one({"order_id": payload.order_id}, {"$set": {"payment_status": "failed"}})
        raise HTTPException(400, "Payment verification failed")

    await db.orders.update_one(
        {"order_id": payload.order_id},
        {"$set": {
            "payment_status": "paid",
            "status": "placed",
            "cf_payment_id": payload.cf_payment_id,
        }},
    )
    await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": []}})

    # Fire paid-order email with full order/product details
    order["payment_status"] = "paid"
    order["status"] = "placed"
    order["cf_payment_id"] = payload.cf_payment_id

    background_tasks.add_task(send_multiple_emails, [
        {"to": order["user_email"], "subject": f"Ayutree order confirmed — #{order['order_id']}", "html": _customer_order_email_body(order)},
        {"to": ADMIN_EMAIL, "subject": f"New Ayutree order — #{order['order_id']}", "html": _admin_order_email_body(order)}
    ])
    return {"ok": True}


@api.post("/payments/razorpay/verify")
async def verify_razorpay_payment(payload: RazorpayVerifyIn, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": payload.order_id})
    if not order or order["user_id"] != user["user_id"]:
        raise HTTPException(404, "Order not found")
        
    if not RAZORPAY_KEY_SECRET:
        raise HTTPException(500, "Razorpay secret key is not configured")

    # Generate signature and compare
    import hmac
    import hashlib
    
    msg = f"{payload.razorpay_order_id}|{payload.razorpay_payment_id}"
    generated_signature = hmac.new(
        RAZORPAY_KEY_SECRET.encode("utf-8"),
        msg.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    
    if generated_signature != payload.razorpay_signature:
        await db.orders.update_one({"order_id": payload.order_id}, {"$set": {"payment_status": "failed"}})
        raise HTTPException(400, "Invalid payment signature")
    
    # Update order status to paid and placed
    await db.orders.update_one(
        {"order_id": payload.order_id},
        {"$set": {
            "payment_status": "paid",
            "status": "placed",
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature
        }}
    )
    
    # Clear user cart
    await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": []}})
    
    # Send confirmation email with full order/product details
    order["payment_status"] = "paid"
    order["status"] = "placed"
    order["razorpay_payment_id"] = payload.razorpay_payment_id
    order["razorpay_signature"] = payload.razorpay_signature

    background_tasks.add_task(send_multiple_emails, [
        {"to": order["user_email"], "subject": f"Ayutree order confirmed — #{order['order_id']}", "html": _customer_order_email_body(order)},
        {"to": ADMIN_EMAIL, "subject": f"New Ayutree order — #{order['order_id']}", "html": _admin_order_email_body(order)}
    ])
    return {"ok": True}



@api.get("/orders")
async def list_my_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders


@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o or (o["user_id"] != user["user_id"] and user.get("role") != "admin"):
        raise HTTPException(404, "Not found")
    
    # Auto-verify Cashfree orders on fetch if still pending
    if o.get("status") == "awaiting_payment" and cashfree_ready and "session_test_" not in o.get("cf_payment_session_id", ""):
        headers = {
            "x-client-id": CASHFREE_APP_ID,
            "x-client-secret": CASHFREE_SECRET_KEY,
            "x-api-version": "2023-08-01"
        }
        try:
            r = requests.get(f"{cashfree_base_url}/orders/{order_id}/payments", headers=headers)
            if r.status_code == 200:
                payments = r.json()
                successful = [p for p in payments if p.get("payment_status") == "SUCCESS"]
                if successful:
                    cf_pay_id = successful[0].get("cf_payment_id", "")
                    await db.orders.update_one(
                        {"order_id": order_id},
                        {"$set": {"payment_status": "paid", "status": "placed", "cf_payment_id": str(cf_pay_id)}}
                    )
                    await db.carts.update_one({"user_id": o["user_id"]}, {"$set": {"items": []}})
                    # We could trigger the email here, but for simplicity we just update status
                    o["payment_status"] = "paid"
                    o["status"] = "placed"
        except Exception as e:
            pass
            
    return o


# -----------------------------
# Reviews
# -----------------------------
@api.post("/reviews")
async def add_review(payload: ReviewIn, user: dict = Depends(get_current_user)):
    doc = {
        "review_id": f"rev_{uuid.uuid4().hex[:10]}",
        "product_id": payload.product_id,
        "user_id": user["user_id"],
        "user_name": user.get("name", "Customer"),
        "rating": max(1, min(5, payload.rating)),
        "comment": payload.comment,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc


# -----------------------------
# Coupon helpers
# -----------------------------
async def _resolve_coupon(code: str, subtotal: float) -> dict:
    code = (code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Coupon code required")
    c = await db.coupons.find_one({"code": code}, {"_id": 0})
    if not c or not c.get("active", True):
        raise HTTPException(400, "Invalid or inactive coupon")
    if c.get("expires_at"):
        try:
            exp = datetime.fromisoformat(c["expires_at"])
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc):
                raise HTTPException(400, "Coupon expired")
        except (ValueError, TypeError):
            pass
    if c.get("usage_limit") and c.get("used_count", 0) >= c["usage_limit"]:
        raise HTTPException(400, "Coupon usage limit reached")
    if subtotal < c.get("min_order", 0):
        raise HTTPException(400, f"Minimum order of ₹{int(c.get('min_order', 0))} required")
    return c


def _coupon_discount(coupon: dict, subtotal: float) -> float:
    if coupon["type"] == "percent":
        d = subtotal * (coupon["value"] / 100.0)
        if coupon.get("max_discount"):
            d = min(d, coupon["max_discount"])
    else:
        d = float(coupon["value"])
    return round(min(d, subtotal), 2)


@api.post("/coupons/validate")
async def coupon_validate(payload: CouponValidateIn, user: dict = Depends(get_current_user)):
    c = await _resolve_coupon(payload.code, payload.subtotal)
    discount = _coupon_discount(c, payload.subtotal)
    return {
        "code": c["code"],
        "type": c["type"],
        "value": c["value"],
        "discount": discount,
        "description": c.get("description", ""),
    }


# -----------------------------
# Categories (admin CRUD)
# -----------------------------
@api.post("/admin/categories")
async def admin_create_category(payload: CategoryIn, admin: dict = Depends(get_admin_user)):
    slug = payload.slug.lower().strip()
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(400, "Category slug already exists")
    doc = {"slug": slug, "name": payload.name, "image": payload.image}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/categories/{slug}")
async def admin_update_category(slug: str, payload: CategoryUpdate, admin: dict = Depends(get_admin_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.categories.update_one({"slug": slug}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    c = await db.categories.find_one({"slug": slug}, {"_id": 0})
    return c


@api.delete("/admin/categories/{slug}")
async def admin_delete_category(slug: str, admin: dict = Depends(get_admin_user)):
    in_use = await db.products.count_documents({"category": slug})
    if in_use:
        raise HTTPException(400, f"{in_use} product(s) still use this category. Move or remove them first.")
    await db.categories.delete_one({"slug": slug})
    return {"ok": True}


@api.get("/admin/categories/{slug}/products")
async def admin_category_products(slug: str, admin: dict = Depends(get_admin_user)):
    items = await db.products.find({"category": slug}, {"_id": 0}).to_list(500)
    return items


# -----------------------------
# Coupons (admin CRUD)
# -----------------------------
@api.get("/admin/coupons")
async def admin_list_coupons(admin: dict = Depends(get_admin_user)):
    items = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api.post("/admin/coupons")
async def admin_create_coupon(payload: CouponIn, admin: dict = Depends(get_admin_user)):
    code = payload.code.strip().upper()
    if not code:
        raise HTTPException(400, "Code is required")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(400, "Coupon code already exists")
    doc = payload.model_dump()
    doc["code"] = code
    doc["used_count"] = 0
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.patch("/admin/coupons/{code}")
async def admin_update_coupon(code: str, payload: CouponUpdate, admin: dict = Depends(get_admin_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    res = await db.coupons.update_one({"code": code.upper()}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    c = await db.coupons.find_one({"code": code.upper()}, {"_id": 0})
    return c


@api.delete("/admin/coupons/{code}")
async def admin_delete_coupon(code: str, admin: dict = Depends(get_admin_user)):
    await db.coupons.delete_one({"code": code.upper()})
    return {"ok": True}


# -----------------------------
# Reviews (admin)
# -----------------------------
@api.get("/admin/reviews")
async def admin_list_reviews(admin: dict = Depends(get_admin_user)):
    reviews = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # enrich with product name
    for r in reviews:
        p = await db.products.find_one({"product_id": r["product_id"]}, {"name": 1, "_id": 0})
        r["product_name"] = (p or {}).get("name", "Unknown")
    return reviews


@api.delete("/admin/reviews/{review_id}")
async def admin_delete_review(review_id: str, admin: dict = Depends(get_admin_user)):
    await db.reviews.delete_one({"review_id": review_id})
    return {"ok": True}


@api.post("/admin/orders/{order_id}/request-review")
async def admin_request_review(order_id: str, background_tasks: BackgroundTasks, admin: dict = Depends(get_admin_user)):
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o.get("status") != "delivered":
        raise HTTPException(400, "Order must be marked delivered before requesting a review")
    items_html = "".join([
        f"<tr><td style='padding:8px 0;'><a href='{FRONTEND_URL_FOR_LINKS}/product/{it['product_id']}' "
        f"style='color:#1A3B32;text-decoration:none;'>{it['name']}</a></td></tr>"
        for it in o.get("items", [])
    ])
    body = _email_layout(
        "How is your ritual going?",
        f"""<p>Hello {o['address'].get('full_name', '')},</p>
        <p>We hope you're loving your recent Ayutree order. If you have a moment, would you mind sharing a review? It helps other ritual-seekers and keeps small-batch makers like us going.</p>
        <table width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #E8E1D5;border-bottom:1px solid #E8E1D5;margin:16px 0;font-size:14px;'>
          {items_html}
        </table>
        <p>Tap a product above to leave a review.</p>""",
    )
    background_tasks.add_task(send_email, o["user_email"], "Share your Ayutree ritual — your review matters", body)
    await db.orders.update_one({"order_id": order_id}, {"$set": {"review_requested_at": datetime.now(timezone.utc).isoformat()}})
    return {"ok": True, "email_sent": True}


# -----------------------------
# Forgot / Reset Password
# -----------------------------
@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn, background_tasks: BackgroundTasks):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and user.get("auth_provider", "local") == "local":
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "email": email,
            "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        link = f"{FRONTEND_URL_FOR_LINKS}/reset-password?token={token}"
        body = _email_layout(
            "Reset your password",
            f"""<p>Hello {user.get('name', '')},</p>
            <p>We received a request to reset your Ayutree account password. Click the button below to choose a new one. The link expires in 1 hour.</p>
            <p style="margin:24px 0;"><a href="{link}" style="background:#1A3B32;color:#F9F6F0;padding:14px 24px;text-decoration:none;letter-spacing:0.15em;text-transform:uppercase;font-size:12px;">Reset Password</a></p>
            <p style="color:#5C6B64;font-size:12px;">If the button does not work, paste this link into your browser:<br/>{link}</p>
            <p style="color:#5C6B64;font-size:12px;">If you did not request a reset, you can safely ignore this email.</p>""",
        )
        background_tasks.add_task(send_email, email, "Reset your Ayutree password", body)
        logging.getLogger("ayutree").info(f"[reset] {email} -> {link}")
    return {"ok": True}


@api.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    rec = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not rec:
        raise HTTPException(400, "Invalid or used token")
    exp = rec["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expired")
    if len(payload.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    await db.users.update_one({"email": rec["email"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"ok": True}


# -----------------------------
# Image Upload (admin only)
# -----------------------------
@api.post("/admin/upload")
async def admin_upload(file: UploadFile = File(...), admin: dict = Depends(get_admin_user)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only image uploads allowed")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5 MB)")
    fname = file.filename or "img.bin"
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "bin"
    path = f"{APP_NAME}/products/{uuid.uuid4().hex}.{ext}"
    result = put_object(path, data, file.content_type)
    await db.uploads.insert_one({
        "upload_id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": fname,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "uploaded_by": admin["user_id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    content, ctype = get_object(path)
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


# -----------------------------
# Chat Bot Endpoints
# -----------------------------
class ChatMessage(BaseModel):
    role: str # user | assistant
    content: str


class ChatIn(BaseModel):
    messages: List[ChatMessage]
    provider: Optional[str] = None
    api_key: Optional[str] = None


def generate_fallback_bot_reply(query: str, products: list) -> str:
    query_lower = query.lower()
    
    # 1. Hello / greetings
    if any(greet in query_lower for greet in ["hello", "hi", "hey", "greetings", "namaste"]):
        return (
            "Namaste! I am AyuBot, your Ayutree wellness assistant. "
            "How can I help you discover the perfect Ayurvedic ritual for your hair, skin, or body today? "
            "Feel free to ask me for recommendations!"
        )
        
    # 2. About Ayutree
    if any(kwd in query_lower for kwd in ["about ayutree", "who are you", "what is ayutree", "brand", "story", "philosophy"]):
        return (
            "Ayutree is a premium Ayurvedic skincare and wellness brand. "
            "Inspired by grandmothers' kitchens and ancient texts, we handcraft our products in small batches using 100% natural, "
            "botanical-first ingredients. All our formulations are completely free from parabens, sulphates, and shortcuts. "
            "We believe in returning to slow beauty and mindful daily wellness rituals."
        )

    # 3. Product category recommendations
    if "face" in query_lower or "skin" in query_lower:
        face_products = [p for p in products if p.get("category") == "face-care"]
        if face_products:
            names = ", ".join([p["name"] for p in face_products[:3]])
            return (
                f"For Face Care, we have some beautiful natural products like: {names}. "
                "For example, our Charcoal Face Wash offers deep-cleansing detox, and our Kachur & Jojoba Cream helps with anti-pigmentation. "
                "What specific skin goal or concern are you focusing on?"
            )
            
    if "hair" in query_lower or "scalp" in query_lower:
        hair_products = [p for p in products if p.get("category") == "hair-care"]
        if hair_products:
            names = ", ".join([p["name"] for p in hair_products[:3]])
            return (
                f"For Hair Care, some of our customer favorites include: {names}. "
                "Our bhringraj-infused Ancient Method Hair Oil promotes hair growth, and the Hibiscus Shampoo conditions beautifully. "
                "Are you trying to address hair fall, premature greying, or dry hair?"
            )
            
    if "soap" in query_lower:
        soap_products = [p for p in products if p.get("category") == "soaps"]
        if soap_products:
            names = ", ".join([p["name"] for p in soap_products[:4]])
            return (
                f"We offer hand-crafted natural soaps like: {names}. "
                "Our Tulasi Soap protects with holy basil, and the ABC Soap (Apple-Beetroot-Carrot) brightens the skin. "
                "Which one appeals to you?"
            )

    if "lip" in query_lower:
        lip_products = [p for p in products if p.get("category") == "lip-care"]
        if lip_products:
            names = ", ".join([p["name"] for p in lip_products[:3]])
            return (
                f"For Lip Care, we have: {names}. "
                "Our Pinky Lip Balm contains beetroot for a natural pink tint, while the Yellow Fellow is saffron-infused to heal dry lips."
            )

    if "pain" in query_lower or "relief" in query_lower or "joint" in query_lower or "muscle" in query_lower:
        return (
            "For joint or muscle discomfort, we suggest our warm Pain Relief Oil. "
            "It is crafted with Mahanarayan and eucalyptus to soothe pain and improve mobility."
        )

    # 4. Search matching product names
    matched_products = []
    for p in products:
        if p["name"].lower() in query_lower:
            matched_products.append(p)
            
    if matched_products:
        p = matched_products[0]
        benefits_str = ", ".join(p.get("benefits", []))
        return (
            f"Ah, {p['name']}! That is an excellent choice. "
            f"It is priced at ₹{int(p['price'])}. "
            f"Key benefits include: {benefits_str}. "
            f"It is formulated with: {p.get('ingredients', 'natural herbs')}. "
            "Would you like to add it to your cart?"
        )

    # 5. General fallback recommendation
    return (
        "I'd love to help you with that! However, my advanced AI mode is currently offline. "
        "To enable my premium general-purpose AI capabilities (allowing me to answer any general knowledge, "
        "lifestyle, coding, recipes, history, or math questions like ChatGPT or Claude), please ensure that "
        "the 'EMERGENT_LLM_KEY' is configured in your backend environment variables.\n\n"
        "For now, as your offline virtual assistant, I can help you find products! "
        "Try asking me about categories like 'face care', 'hair oil', or specific products like 'Charcoal Face Wash'."
    )


@api.post("/contact")
async def submit_contact(payload: ContactIn, background_tasks: BackgroundTasks):
    email_body = _email_layout(
        f"Contact Us Message: {payload.subject}",
        f"""<p>You have received a new message from the contact form:</p>
            <p><b>Name:</b> {payload.name}</p>
            <p><b>Email:</b> {payload.email}</p>
            <p><b>Subject:</b> {payload.subject}</p>
            <p><b>Message:</b><br/>{payload.message}</p>"""
    )
    user_body = _email_layout(
        "We have received your message",
        f"""<p>Hello {payload.name},</p>
            <p>Thank you for contacting Ayutree. We have received your query regarding <b>"{payload.subject}"</b> and will get back to you within 24 hours.</p>
            <p>Best regards,<br/>Ayutree Team</p>"""
    )
    background_tasks.add_task(send_multiple_emails, [
        {"to": ADMIN_EMAIL, "subject": f"New Contact Message: {payload.subject}", "html": email_body},
        {"to": payload.email, "subject": "We received your query — Ayutree Support", "html": user_body}
    ])
    return {"ok": True}


@api.post("/chat")
async def chat_bot(payload: ChatIn):
    # Retrieve all products from database for context
    products = await db.products.find({}, {"_id": 0}).to_list(100)
    catalog_summary = "\n".join([
        f"- {p['name']} ({p['category']}): {p['price']} INR. MRP: {p.get('mrp', p['price'])} INR. "
        f"Benefits: {', '.join(p.get('benefits', []))}. "
        f"Description: {p.get('short_description', '')}"
        for p in products
    ])

    system_prompt = (
        "You are AyuBot, a premium, highly intelligent, and warm AI assistant. "
        "While you are the brand assistant for Ayutree (a premium Ayurvedic skincare and wellness brand), "
        "you are also a fully capable general AI assistant (like ChatGPT or Claude). "
        "You must answer ANY questions asked by the user, including general knowledge, history, "
        "science, math, coding, recipes, lifestyle advice, or general conversation. "
        "Do not restrict yourself to only Ayutree or refuse non-brand questions. "
        "Answer all general questions fully, accurately, and professionally, but maintain a helpful, warm, and premium tone. "
        "If appropriate and natural, you can subtly connect the user's query to wellness or suggest relevant Ayutree products, "
        "but prioritize answering their actual question first. "
        "Only refuse to answer if the query contains explicit, illegal, or harmful/violating content. "
        f"Here is our current product catalogue for reference:\n{catalog_summary}"
    )

    user_msg = payload.messages[-1].content if payload.messages else ""

    # Resolve the API key and provider to use
    selected_provider = payload.provider
    selected_key = payload.api_key

    if not selected_key:
        # Fallback to server env keys
        if GEMINI_API_KEY:
            selected_provider = "gemini"
            selected_key = GEMINI_API_KEY
        elif OPENAI_API_KEY:
            selected_provider = "openai"
            selected_key = OPENAI_API_KEY
        elif EMERGENT_LLM_KEY:
            selected_provider = "litellm"
            selected_key = EMERGENT_LLM_KEY

    # Auto-detect provider if key is provided but provider isn't
    if selected_key and not selected_provider:
        if selected_key.startswith("AIza"):
            selected_provider = "gemini"
        elif selected_key.startswith("sk-"):
            selected_provider = "openai"
        else:
            selected_provider = "gemini"  # Default to gemini

    # Call LLM based on resolved provider and key
    if selected_key and selected_provider:
        try:
            import litellm
            # Construct messages for litellm
            litellm_msgs = [{"role": "system", "content": system_prompt}]
            for msg in payload.messages:
                litellm_msgs.append({"role": msg.role, "content": msg.content})

            # Map provider to model name
            if selected_provider == "gemini":
                model_name = "gemini/gemini-1.5-flash"
            elif selected_provider == "openai" or selected_provider == "litellm":
                model_name = "gpt-4o-mini"
            else:
                model_name = "gpt-4o-mini"

            response = await asyncio.to_thread(
                litellm.completion,
                model=model_name,
                messages=litellm_msgs,
                api_key=selected_key,
                timeout=30
            )
            reply = response.choices[0].message.content
            return {"reply": reply}
        except Exception as e:
            logging.getLogger("ayutree").warning(f"LiteLLM chat failed for {selected_provider}: {e}")

    # Fallback to rule-based mock reply
    reply = generate_fallback_bot_reply(user_msg, products)
    return {"reply": reply}
@api.get("/admin/orders")
async def admin_list_orders(admin: dict = Depends(get_admin_user)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, body: dict, background_tasks: BackgroundTasks, admin: dict = Depends(get_admin_user)):
    allowed = {k: v for k, v in body.items() if k in {"status", "payment_status", "tracking_id"}}
    prev = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    await db.orders.update_one({"order_id": order_id}, {"$set": allowed})
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Notify customer and admin on shipped/delivered/cancelled transitions
    if prev and o and allowed.get("status") and prev.get("status") != o.get("status"):
        if o["status"] == "shipped":
            tracking = allowed.get("tracking_id") or o.get("tracking_id") or "(not provided)"
            html = _email_layout(
                f"Your order has shipped — #{order_id}",
                f"<p>Good news! Your Ayutree order #{order_id} has shipped.</p><p>Tracking: <b>{tracking}</b></p>",
            )
            background_tasks.add_task(send_multiple_emails, [
                {"to": o["user_email"], "subject": f"Your Ayutree order has shipped — #{order_id}", "html": html},
                {"to": ADMIN_EMAIL, "subject": f"Order shipped — #{order_id}", "html": html}
            ])
        elif o["status"] == "delivered":
            html = _email_layout(
                f"Delivered — #{order_id}",
                "<p>Your Ayutree order has been delivered. We hope you love it.</p><p>Mind sharing a review? It helps fellow ritual-seekers.</p>",
            )
            background_tasks.add_task(send_multiple_emails, [
                {"to": o["user_email"], "subject": f"Delivered: Ayutree order #{order_id}", "html": html},
                {"to": ADMIN_EMAIL, "subject": f"Order delivered — #{order_id}", "html": html}
            ])
        elif o["status"] == "cancelled":
            html = _email_layout(
                f"Order cancelled — #{order_id}",
                f"<p>Hello,</p><p>We regret to inform you that Ayutree order #{order_id} has been cancelled.</p><p>If this was an error or if you have any questions, please contact our support team.</p>",
            )
            background_tasks.add_task(send_multiple_emails, [
                {"to": o["user_email"], "subject": f"Cancelled: Ayutree order #{order_id}", "html": html},
                {"to": ADMIN_EMAIL, "subject": f"Order cancelled — #{order_id}", "html": html}
            ])
    return o


@api.get("/admin/customers")
async def admin_list_customers(admin: dict = Depends(get_admin_user)):
    users = await db.users.find({"role": "customer"}, {"_id": 0, "password_hash": 0}).to_list(1000)
    # enrich with order count
    out = []
    for u in users:
        cnt = await db.orders.count_documents({"user_id": u["user_id"]})
        spend_cursor = db.orders.find({"user_id": u["user_id"], "payment_status": "paid"}, {"total": 1, "_id": 0})
        spend = 0
        async for o in spend_cursor:
            spend += o.get("total", 0)
        out.append({**u, "orders_count": cnt, "total_spend": spend})
    return out


@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_admin_user)):
    total_orders = await db.orders.count_documents({})
    total_customers = await db.users.count_documents({"role": "customer"})
    total_products = await db.products.count_documents({})
    revenue = 0
    async for o in db.orders.find({"payment_status": {"$in": ["paid"]}}, {"total": 1}):
        revenue += o.get("total", 0)
    # COD revenue counted on delivered
    async for o in db.orders.find({"payment_method": "cod", "status": {"$in": ["placed", "shipped", "delivered"]}}, {"total": 1}):
        revenue += o.get("total", 0)

    # last 7 day buckets
    today = datetime.now(timezone.utc).date()
    sales_chart = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        ds = d.isoformat()
        day_total = 0
        async for o in db.orders.find({"created_at": {"$regex": f"^{ds}"}}, {"total": 1}):
            day_total += o.get("total", 0)
        sales_chart.append({"date": ds, "total": round(day_total, 2)})

    # top products
    pipeline = [
        {"$unwind": "$items"},
        {"$group": {"_id": "$items.product_id", "name": {"$first": "$items.name"}, "qty": {"$sum": "$items.qty"}, "revenue": {"$sum": "$items.total"}}},
        {"$sort": {"qty": -1}},
        {"$limit": 5},
    ]
    top_products = []
    async for r in db.orders.aggregate(pipeline):
        top_products.append({"product_id": r["_id"], "name": r["name"], "qty": r["qty"], "revenue": r["revenue"]})

    # low stock
    low_stock = await db.products.find({"stock": {"$lt": 20}}, {"_id": 0}).limit(10).to_list(10)

    total_reviews = await db.reviews.count_documents({})
    total_coupons = await db.coupons.count_documents({"active": True})

    return {
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_products": total_products,
        "total_reviews": total_reviews,
        "total_coupons": total_coupons,
        "revenue": round(revenue, 2),
        "sales_chart": sales_chart,
        "top_products": top_products,
        "low_stock": low_stock,
    }


# -----------------------------
# Seed
# -----------------------------
SEED_CATEGORIES = [
    {"slug": "face-care", "name": "Face Care", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/Screenshot_2023-11-20_170537.png?v=1700480211"},
    {"slug": "hair-care", "name": "Hair Care", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/young-brunette-with-leaves-looking-camera.jpg?v=1700481323"},
    {"slug": "body-care", "name": "Body Care", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/Screenshot_2023-11-20_163840.png?v=1700478942"},
    {"slug": "soaps", "name": "Soaps", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/close-up-organic-soap-bars_1.jpg?v=1700541541"},
    {"slug": "lip-care", "name": "Lip Care", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/young-beautiful-brunette-girl-tropical-plants-grey-wall.jpg?v=1700471092"},
    {"slug": "eye-care", "name": "Eye Care", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/Screenshot_2023-11-21_100236.png?v=1700541182"},
    {"slug": "men", "name": "Men Exclusive", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/pexels-behrouz-sasani-7094172_1.jpg?v=1700478608"},
    {"slug": "kids", "name": "Kids", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/pexels-daisy-laparra-826734_1.jpg?v=1700481358"},
    {"slug": "foot-care", "name": "Foot Care", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/Screenshot_2023-11-20_161406.png?v=1700478263"},
    {"slug": "pain-relief", "name": "Pain Relief", "image": "https://cdn.shopify.com/s/files/1/0815/2327/8102/collections/oil_massage.png?v=1701943588"},
]

SEED_PRODUCTS = [
    # Face Wash
    {"name": "Charcoal Face Wash", "category": "face-care", "price": 249, "mrp": 299, "image": "https://ayutree.com/cdn/shop/files/2_5b24a08a-bdac-47aa-996a-cbbca2db68fb.png?v=1731324516", "short_description": "Deep-cleansing charcoal detox for clear, refined skin.", "ingredients": "Activated charcoal, neem, tea tree oil, aloe vera", "benefits": ["Removes impurities", "Controls excess oil", "Minimises pores"]},
    {"name": "Anti-Acne Face Wash", "category": "face-care", "price": 229, "mrp": 279, "image": "https://ayutree.com/cdn/shop/files/4_6387b041-2295-47a4-ba05-79060f0aa381.png?v=1731752732", "short_description": "Calms breakouts and brightens dull skin.", "ingredients": "Turmeric, neem, salicylic acid (natural), tulsi", "benefits": ["Reduces acne", "Soothes inflammation", "Evens tone"]},
    {"name": "Anti-Acne Face Cream", "category": "face-care", "price": 349, "mrp": 399, "image": "https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=800&q=80", "short_description": "Lightweight cream that targets active acne overnight.", "ingredients": "Tea tree, kumkumadi, sandalwood, manjistha", "benefits": ["Spot treatment", "Non-comedogenic", "Heals scars"]},
    {"name": "Kachur & Jojoba Oil Cream", "category": "face-care", "price": 399, "mrp": 499, "image": "https://ayutree.com/cdn/shop/files/1_593228cb-3796-4739-a5c8-be08cbc83da2.png?v=1729836490", "short_description": "Anti-pigmentation cream with rare kachur root.", "ingredients": "Kachur, jojoba oil, saffron, milk cream", "benefits": ["Lightens dark spots", "Deep hydration", "Anti-aging"]},
    {"name": "Skin Whitening Cream", "category": "face-care", "price": 449, "mrp": 549, "image": "https://ayutree.com/cdn/shop/files/4_c062daa7-6906-40ea-9683-4f8f0dda589c.png?v=1728554851", "short_description": "Brightening cream with saffron & mulethi.", "ingredients": "Saffron, mulethi, sandalwood, vitamin C", "benefits": ["Brightens complexion", "Reduces tan", "Even skin tone"]},
    {"name": "Face Powder", "category": "face-care", "price": 299, "mrp": 349, "image": "https://images.unsplash.com/photo-1631214540242-c3b6ba39cae2?w=800&q=80", "short_description": "Ayurvedic compact for a matte natural finish.", "ingredients": "Rice powder, kaolin clay, sandalwood", "benefits": ["Oil control", "Natural matte", "Soothing"]},

    # Hair Care
    {"name": "Hair Oil", "category": "hair-care", "price": 249, "mrp": 299, "image": "https://ayutree.com/cdn/shop/files/DSC01200.jpg?v=1699247083", "short_description": "Classic blend for strong, lustrous hair.", "ingredients": "Coconut, sesame, amla, brahmi", "benefits": ["Stops hair fall", "Adds shine", "Scalp nourishment"]},
    {"name": "Ancient Method Hair Oil", "category": "hair-care", "price": 449, "mrp": 549, "image": "https://images.unsplash.com/photo-1620766165457-d49fe83ff7d4?w=800&q=80", "short_description": "Hand-cooked 1000-year-old ayurvedic recipe.", "ingredients": "Bhringraj, hibiscus, neelibhringadi, sesame", "benefits": ["Premature greying", "Promotes growth", "Calms scalp"]},
    {"name": "No More Tears Shampoo", "category": "hair-care", "price": 269, "mrp": 319, "image": "https://ayutree.com/cdn/shop/files/DSC01325.jpg?v=1699251081", "short_description": "Gentle tear-free shampoo for the whole family.", "ingredients": "Shikakai, reetha, aloe vera", "benefits": ["No tears", "Mild lather", "Daily use"]},
    {"name": "Hibiscus Shampoo", "category": "hair-care", "price": 289, "mrp": 339, "image": "https://ayutree.com/cdn/shop/files/1_d0cd6605-6266-43d2-ab8b-9ef59140b009.png?v=1729923789", "short_description": "Floral cleanser for stronger, fuller hair.", "ingredients": "Hibiscus, fenugreek, amla", "benefits": ["Hair fall control", "Adds volume", "Natural conditioning"]},
    {"name": "Coconut Shampoo", "category": "hair-care", "price": 269, "mrp": 319, "image": "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80", "short_description": "Cooling coconut shampoo for dry, brittle hair.", "ingredients": "Virgin coconut, curry leaf, bhringraj", "benefits": ["Deep moisturising", "Reduces frizz", "Cooling"]},
    {"name": "Hair Growth Serum", "category": "hair-care", "price": 549, "mrp": 699, "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80", "short_description": "Daily scalp serum for visibly thicker hair.", "ingredients": "Bhringraj, rosemary, peptides, biotin", "benefits": ["Stimulates roots", "Reduces shedding", "Lightweight"]},
    {"name": "Frizz Free Serum", "category": "hair-care", "price": 399, "mrp": 449, "image": "https://ayutree.com/cdn/shop/files/1_083fae6a-1e94-46e2-a384-fad75d7d35b5.png?v=1734605768", "short_description": "Smoothing serum for salon-soft hair.", "ingredients": "Argan, almond, jojoba", "benefits": ["Tames frizz", "Adds shine", "Heat protection"]},
    {"name": "Her Shine Hair Pack", "category": "hair-care", "price": 349, "mrp": 399, "image": "https://images.unsplash.com/photo-1626015449398-1d29b9b5e5c5?w=800&q=80", "short_description": "Weekly mask for mirror-shine.", "ingredients": "Henna, shikakai, multani mitti", "benefits": ["Deep nourishment", "Shine boost", "Damage repair"]},
    {"name": "Hair Color Dye", "category": "hair-care", "price": 499, "mrp": 599, "image": "https://ayutree.com/cdn/shop/files/IMG-1371.jpg?v=1694006229", "short_description": "Herbal hair colour without harsh chemicals.", "ingredients": "Henna, indigo, amla, bhringraj", "benefits": ["Ammonia-free", "Covers grey", "Conditions hair"]},
    {"name": "Deep Conditioning Hair Mask", "category": "hair-care", "price": 449, "mrp": 549, "image": "https://ayutree.com/cdn/shop/files/1.png?v=1724143893", "short_description": "Intense hydration mask for dry strands.", "ingredients": "Avocado, shea butter, hibiscus", "benefits": ["Restores moisture", "Repairs split ends", "Softens"]},

    # Body Care
    {"name": "Baby Massage Oil", "category": "kids", "price": 299, "mrp": 349, "image": "https://ayutree.com/cdn/shop/files/1_67161386-b440-4ca3-9777-9f2b023da1a5.png?v=1728894001", "short_description": "Gentle warming oil for baby's daily massage.", "ingredients": "Almond, sesame, ashwagandha", "benefits": ["Strengthens bones", "Better sleep", "Soft skin"]},
    {"name": "Body Lotion - Bay Leaf", "category": "body-care", "price": 329, "mrp": 379, "image": "https://ayutree.com/cdn/shop/files/bodylotionpost1.png?v=1723804518", "short_description": "Calming bay leaf body lotion for everyday glow.", "ingredients": "Bay leaf, shea butter, almond oil", "benefits": ["24h hydration", "Soothes", "Aromatic"]},
    {"name": "Body Lotion for Kids", "category": "kids", "price": 299, "mrp": 349, "image": "https://ayutree.com/cdn/shop/files/3_c74f66a6-d5f7-4ea5-9166-43a5bb38deb4.png?v=1727761025", "short_description": "Gentle daily lotion for delicate skin.", "ingredients": "Calendula, shea, aloe vera", "benefits": ["Hypoallergenic", "Soft skin", "All-day care"]},
    {"name": "Talcum Powder", "category": "body-care", "price": 199, "mrp": 249, "image": "https://images.unsplash.com/photo-1610505687678-d4fd3a8c5bb1?w=800&q=80", "short_description": "Cooling herbal talc for fresh comfort.", "ingredients": "Sandalwood, vetiver, khus", "benefits": ["Cooling", "Absorbs sweat", "Light fragrance"]},
    {"name": "Bath Powder", "category": "body-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80", "short_description": "Traditional ubtan for glowing skin.", "ingredients": "Chickpea flour, turmeric, sandalwood, rose", "benefits": ["Natural exfoliation", "Glow", "Removes tan"]},
    {"name": "Under Arm Roll On", "category": "body-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1626015449398-1d29b9b5e5c5?w=800&q=80", "short_description": "Aluminum-free roll-on with kasturi turmeric.", "ingredients": "Kasturi turmeric, alum, witch hazel", "benefits": ["48h freshness", "Lightens", "Skin-friendly"]},

    # Soaps
    {"name": "Tulasi Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://ayutree.com/cdn/shop/files/DSC01340.jpg?v=1699272034", "short_description": "Holy basil soap that purifies & protects.", "ingredients": "Tulsi, coconut oil, neem", "benefits": ["Antibacterial", "Refreshing", "Daily use"]},
    {"name": "ABC Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://ayutree.com/cdn/shop/files/4_bd1db2c1-61d3-4fd2-acc8-10c34f9a0970.png?v=1729927635", "short_description": "Apple-Beetroot-Carrot soap for radiant skin.", "ingredients": "Apple, beetroot, carrot extracts", "benefits": ["Brightens", "Vitamin-rich", "Even tone"]},
    {"name": "Tomato Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://ayutree.com/cdn/shop/files/2_01926c89-0a29-40e3-860e-9d96a47ac07b.png?v=1729935854", "short_description": "Tomato extract soap for tan removal.", "ingredients": "Tomato pulp, vitamin C, sandalwood", "benefits": ["Removes tan", "Brightens", "Antioxidant"]},
    {"name": "Kuppaimeni Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://ayutree.com/cdn/shop/files/DSC01338.jpg?v=1699271713", "short_description": "Indian acalypha soap for skin allergies.", "ingredients": "Kuppaimeni, neem, turmeric", "benefits": ["Anti-bacterial", "Calms itch", "Heals"]},
    {"name": "Papaya Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://ayutree.com/cdn/shop/files/DSC01341.jpg?v=1699272445", "short_description": "Enzyme-rich papaya soap for soft skin.", "ingredients": "Papaya, honey, milk", "benefits": ["Gentle exfoliation", "Softens", "Glow"]},
    {"name": "Neem Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://ayutree.com/cdn/shop/files/DSC01337_8874f5be-0a2d-492b-beb0-c569217bb2fc.jpg?v=1699599601", "short_description": "Pure neem soap for acne-prone skin.", "ingredients": "Neem, coconut, basil", "benefits": ["Anti-acne", "Antifungal", "Clean skin"]},
    {"name": "Charcoal Soap", "category": "soaps", "price": 119, "mrp": 149, "image": "https://ayutree.com/cdn/shop/files/DSC01339.jpg?v=1699271863", "short_description": "Activated charcoal soap deep cleanse.", "ingredients": "Activated charcoal, tea tree, olive oil", "benefits": ["Detoxifies", "Unclogs pores", "Refreshing"]},

    # Lip Care
    {"name": "Pinky Lip Balm", "category": "lip-care", "price": 149, "mrp": 199, "image": "https://ayutree.com/cdn/shop/files/1_566a409f-3a44-432c-8ae5-f0a3a510b813.png?v=1735797260", "short_description": "Tinted balm for soft pink lips.", "ingredients": "Beetroot, shea butter, beeswax", "benefits": ["Natural tint", "Soft lips", "Sun-kissed"]},
    {"name": "Yellow Fellow Lip Balm", "category": "lip-care", "price": 149, "mrp": 199, "image": "https://ayutree.com/cdn/shop/files/1_566a409f-3a44-432c-8ae5-f0a3a510b813.png?v=1735797260", "short_description": "Saffron-infused balm for healing lips.", "ingredients": "Saffron, honey, almond oil", "benefits": ["Heals dryness", "Glow", "Soothing"]},
    {"name": "Purple Lip Balm", "category": "lip-care", "price": 149, "mrp": 199, "image": "https://ayutree.com/cdn/shop/files/1_566a409f-3a44-432c-8ae5-f0a3a510b813.png?v=1735797260", "short_description": "Berry balm for plump, lush lips.", "ingredients": "Blueberry, beetroot, vitamin E", "benefits": ["Lip plumping", "Lightens darkness", "Hydration"]},
    {"name": "Lipstick", "category": "lip-care", "price": 349, "mrp": 449, "image": "https://ayutree.com/cdn/shop/files/1_e0fbf2e4-45bc-4a1c-abe6-4155d89915f0.png?v=1732604993", "short_description": "Herbal lipstick — long-lasting matte.", "ingredients": "Beeswax, castor oil, natural pigments", "benefits": ["No paraben", "Smooth glide", "Rich pigment"]},

    # Serums & Specialty
    {"name": "Skin Glow Serum", "category": "face-care", "price": 549, "mrp": 699, "image": "https://ayutree.com/cdn/shop/files/1_2a0e4ac0-88ce-4f30-880a-489773eb406b.png?v=1732623850", "short_description": "Daily glow serum with vitamin C & saffron.", "ingredients": "Vitamin C, saffron, hyaluronic acid", "benefits": ["Glow boost", "Anti-pigmentation", "Hydrating"]},
    {"name": "Milk Drop Serum", "category": "face-care", "price": 599, "mrp": 749, "image": "https://ayutree.com/cdn/shop/files/Untitleddesign_17.png?v=1722323268", "short_description": "Milk protein serum for baby-soft skin.", "ingredients": "Milk proteins, kumkumadi, ceramides", "benefits": ["Brightens", "Softens", "Plumping"]},
    {"name": "Goat Milk & Kumkumadi Oil 15mL", "category": "face-care", "price": 699, "mrp": 899, "image": "https://ayutree.com/cdn/shop/files/goatmilkkukumathioil-1.png?v=1723443746", "short_description": "Luxury facial oil blend for night repair.", "ingredients": "Goat milk, kumkumadi, saffron", "benefits": ["Night repair", "Skin brightening", "Anti-aging"]},

    # Eye & Brow
    {"name": "Eyelash & Eyebrow Growth Oil", "category": "eye-care", "price": 349, "mrp": 449, "image": "https://ayutree.com/cdn/shop/files/DSC01177.jpg?v=1699270508", "short_description": "Castor blend for fuller lashes & brows.", "ingredients": "Castor oil, vitamin E, almond", "benefits": ["Lengthens lashes", "Brow growth", "Nourishing"]},
    {"name": "Mascara", "category": "eye-care", "price": 399, "mrp": 499, "image": "https://ayutree.com/cdn/shop/files/2_b0bbe455-0115-4728-b05b-5d21403417d6.png?v=1732176429", "short_description": "Herbal mascara for natural lift.", "ingredients": "Carbon black, beeswax, bhringraj", "benefits": ["Volume", "Smudge-proof", "Conditioning"]},
    {"name": "Kajal", "category": "eye-care", "price": 199, "mrp": 249, "image": "https://ayutree.com/cdn/shop/files/1_944123a7-a8f6-4d8c-91ec-2f1fd85a33ec.png?v=1724494923", "short_description": "Traditional ayurvedic kajal stick.", "ingredients": "Castor oil, ghee, camphor", "benefits": ["Deep black", "Cools eyes", "Long-stay"]},

    # Men
    {"name": "Beard Oil", "category": "men", "price": 449, "mrp": 549, "image": "https://ayutree.com/cdn/shop/files/DSC01599.jpg?v=1700457668", "short_description": "Conditioning beard oil for fuller growth.", "ingredients": "Argan, jojoba, cedarwood", "benefits": ["Softens beard", "Promotes growth", "Tames frizz"]},

    # Foot Care
    {"name": "Foot Crack Cream", "category": "foot-care", "price": 249, "mrp": 299, "image": "https://ayutree.com/cdn/shop/files/DSC01322.jpg?v=1699247287", "short_description": "Heals deep cracks overnight.", "ingredients": "Shea butter, urea, neem", "benefits": ["Repairs cracks", "Softens heels", "Deep moisture"]},

    # Pain Relief
    {"name": "Pain Relief Oil", "category": "pain-relief", "price": 349, "mrp": 449, "image": "https://ayutree.com/cdn/shop/files/IMG_20240724_152921.jpg?v=1722054034", "short_description": "Ayurvedic warm oil for joint & muscle relief.", "ingredients": "Mahanarayan, eucalyptus, gandhapura", "benefits": ["Soothes pain", "Improves mobility", "Warming"]},
]


async def seed_data():
    # Seed admin
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "user_id": f"admin_{uuid.uuid4().hex[:8]}",
            "email": ADMIN_EMAIL,
            "name": "Ayutree Admin",
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "auth_provider": "local",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        # keep password in sync with env
        if not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
            await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})

    # Seed categories (only if they don't exist yet, to prevent overwriting user edits)
    for c in SEED_CATEGORIES:
        await db.categories.update_one({"slug": c["slug"]}, {"$setOnInsert": c}, upsert=True)

    # Seed products (only if collection empty)
    cnt = await db.products.count_documents({})
    if cnt == 0:
        for idx, p in enumerate(SEED_PRODUCTS):
            doc = {
                **p,
                "product_id": f"prod_{uuid.uuid4().hex[:10]}",
                "sku": f"AYU-{1000+idx}",
                "stock": 100,
                "description": p.get("short_description", "") + " Crafted from ancient ayurvedic recipes with hand-picked natural ingredients.",
                "featured": idx < 6,
                "rating": 4.6,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.products.insert_one(doc)

    # Seed default coupons (idempotent)
    default_coupons = [
        {"code": "WELCOME10", "type": "percent", "value": 10, "min_order": 499, "max_discount": 200, "active": True, "description": "10% off your first order above ₹499"},
        {"code": "AYUVEDA20", "type": "percent", "value": 20, "min_order": 999, "max_discount": 400, "active": True, "description": "20% off above ₹999"},
        {"code": "FLAT100", "type": "flat", "value": 100, "min_order": 599, "active": True, "description": "Flat ₹100 off above ₹599"},
    ]
    for c in default_coupons:
        existing = await db.coupons.find_one({"code": c["code"]})
        if not existing:
            await db.coupons.insert_one({**c, "used_count": 0, "created_at": datetime.now(timezone.utc).isoformat()})


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.coupons.create_index("code", unique=True)
    await seed_data()
    # initialise object storage in the background (non-fatal if it fails)
    try:
        init_storage()
    except Exception as e:
        logging.getLogger("ayutree").warning(f"Storage warm-up failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ayutree")
from fastapi.middleware.cors import CORSMiddleware