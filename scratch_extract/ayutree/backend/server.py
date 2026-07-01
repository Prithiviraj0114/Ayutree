from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
import razorpay
import hmac
import hashlib
import requests
import secrets
import asyncio
import resend
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Query, UploadFile, File
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
ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin@ayutree.com').lower()
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'Admin@2026')
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
APP_NAME = os.environ.get('APP_NAME', 'ayutree')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'Ayutree <onboarding@resend.dev>')
FRONTEND_URL_FOR_LINKS = os.environ.get('FRONTEND_URL', 'http://localhost:3000')

STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
_storage_key: Optional[str] = None

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

razorpay_client = None
if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET and not RAZORPAY_KEY_ID.endswith('placeholder'):
    razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

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
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
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


def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=503, detail="Object storage unavailable")
    r = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# -----------------------------
# Helpers - Email
# -----------------------------
async def send_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_API_KEY:
        logging.getLogger("ayutree").info(f"[email-skipped] to={to} subject={subject}")
        return False
    try:
        await asyncio.to_thread(resend.Emails.send, {
            "from": SENDER_EMAIL,
            "to": [to],
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        logging.getLogger("ayutree").error(f"Email send failed: {e}")
        return False


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


class GoogleSessionIn(BaseModel):
    session_id: str


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
    phone: str
    line1: str
    line2: str = ""
    city: str
    state: str
    pincode: str
    country: str = "India"


class CheckoutIn(BaseModel):
    address: AddressIn
    payment_method: str = "cod"  # cod | razorpay


class PaymentVerifyIn(BaseModel):
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class ReviewIn(BaseModel):
    product_id: str
    rating: int
    comment: str = ""


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


@api.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn, response: Response):
    """Exchange Emergent session_id for user data and create our own JWT."""
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": payload.session_id},
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = r.json()
    except requests.RequestException:
        raise HTTPException(status_code=502, detail="Auth service unreachable")

    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture", "")
    if not email:
        raise HTTPException(status_code=400, detail="No email returned")

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
async def checkout(payload: CheckoutIn, user: dict = Depends(get_current_user)):
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
    total = round(subtotal + shipping + tax, 2)

    order_id = f"AYU{datetime.now().strftime('%y%m%d')}{uuid.uuid4().hex[:6].upper()}"
    order_doc = {
        "order_id": order_id,
        "user_id": user["user_id"],
        "user_email": user["email"],
        "items": items_full,
        "subtotal": subtotal,
        "shipping": shipping,
        "tax": tax,
        "total": total,
        "address": payload.address.model_dump(),
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "status": "placed" if payload.payment_method == "cod" else "awaiting_payment",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    razorpay_order = None
    if payload.payment_method == "razorpay":
        if razorpay_client is None:
            # Fallback: simulate order so checkout flow still works
            razorpay_order = {"id": f"order_test_{uuid.uuid4().hex[:10]}", "amount": int(total * 100), "currency": "INR"}
        else:
            razorpay_order = razorpay_client.order.create({
                "amount": int(total * 100),
                "currency": "INR",
                "receipt": order_id[:40],
                "payment_capture": 1,
            })
        order_doc["razorpay_order_id"] = razorpay_order["id"]

    await db.orders.insert_one(order_doc)
    if payload.payment_method == "cod":
        await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": []}})
        # Fire order-placed email for COD
        items_html = "".join([
            f"<tr><td style='padding:8px 0;color:#5C6B64;'>{it['name']} × {it['qty']}</td>"
            f"<td style='padding:8px 0;text-align:right;color:#1A3B32;'>₹{int(it['total'])}</td></tr>"
            for it in items_full
        ])
        body = _email_layout(
            f"Order #{order_id}",
            f"""<p>Hello {payload.address.full_name},</p>
            <p>Thank you for your order. We're packing it with care.</p>
            <table width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #E8E1D5;border-bottom:1px solid #E8E1D5;margin:16px 0;font-size:14px;'>
              {items_html}
              <tr><td style='padding:8px 0;'><b>Total</b></td><td style='padding:8px 0;text-align:right;'><b>₹{int(total)}</b></td></tr>
            </table>
            <p><b>Shipping to:</b><br/>{payload.address.line1}, {payload.address.city}, {payload.address.state} {payload.address.pincode}</p>
            <p style='color:#5C6B64;font-size:12px;'>Payment: Cash on Delivery. We'll send tracking once shipped.</p>""",
        )
        await send_email(user["email"], f"Ayutree order confirmed — #{order_id}", body)

    return {
        "order_id": order_id,
        "total": total,
        "razorpay": razorpay_order,
        "key_id": RAZORPAY_KEY_ID if payload.payment_method == "razorpay" else None,
    }


@api.post("/payments/verify")
async def verify_payment(payload: PaymentVerifyIn, user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"order_id": payload.order_id}, {"_id": 0})
    if not order or order["user_id"] != user["user_id"]:
        raise HTTPException(404, "Order not found")

    # Skip strict verification when in placeholder/test mode
    verified = True
    if razorpay_client is not None:
        try:
            razorpay_client.utility.verify_payment_signature({
                "razorpay_order_id": payload.razorpay_order_id,
                "razorpay_payment_id": payload.razorpay_payment_id,
                "razorpay_signature": payload.razorpay_signature,
            })
        except Exception:
            verified = False

    if not verified:
        await db.orders.update_one({"order_id": payload.order_id}, {"$set": {"payment_status": "failed"}})
        raise HTTPException(400, "Signature verification failed")

    await db.orders.update_one(
        {"order_id": payload.order_id},
        {"$set": {
            "payment_status": "paid",
            "status": "placed",
            "razorpay_payment_id": payload.razorpay_payment_id,
        }},
    )
    await db.carts.update_one({"user_id": user["user_id"]}, {"$set": {"items": []}})

    # Fire paid-order email
    body = _email_layout(
        f"Payment received — #{order['order_id']}",
        f"""<p>Hello {order['address'].get('full_name', '')},</p>
        <p>We've received your payment of <b>₹{int(order['total'])}</b> for order #{order['order_id']}. We'll send tracking when it ships.</p>
        <p style='color:#5C6B64;font-size:12px;'>Payment id: {payload.razorpay_payment_id}</p>""",
    )
    await send_email(user["email"], f"Ayutree payment received — #{order['order_id']}", body)
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
# Forgot / Reset Password
# -----------------------------
@api.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
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
        await send_email(email, "Reset your Ayutree password", body)
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
# Admin
# -----------------------------
@api.get("/admin/orders")
async def admin_list_orders(admin: dict = Depends(get_admin_user)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders


@api.patch("/admin/orders/{order_id}")
async def admin_update_order(order_id: str, body: dict, admin: dict = Depends(get_admin_user)):
    allowed = {k: v for k, v in body.items() if k in {"status", "payment_status", "tracking_id"}}
    prev = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    await db.orders.update_one({"order_id": order_id}, {"$set": allowed})
    o = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    # Notify customer on shipped/delivered transitions
    if prev and o and allowed.get("status") and prev.get("status") != o.get("status"):
        if o["status"] == "shipped":
            tracking = allowed.get("tracking_id") or o.get("tracking_id") or "(not provided)"
            html = _email_layout(
                f"Your order has shipped — #{order_id}",
                f"<p>Good news! Your Ayutree order #{order_id} has shipped.</p><p>Tracking: <b>{tracking}</b></p>",
            )
            await send_email(o["user_email"], f"Your Ayutree order has shipped — #{order_id}", html)
        elif o["status"] == "delivered":
            html = _email_layout(
                f"Delivered — #{order_id}",
                "<p>Your Ayutree order has been delivered. We hope you love it.</p><p>Mind sharing a review? It helps fellow ritual-seekers.</p>",
            )
            await send_email(o["user_email"], f"Delivered: Ayutree order #{order_id}", html)
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

    return {
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_products": total_products,
        "revenue": round(revenue, 2),
        "sales_chart": sales_chart,
        "top_products": top_products,
        "low_stock": low_stock,
    }


# -----------------------------
# Seed
# -----------------------------
SEED_CATEGORIES = [
    {"slug": "face-care", "name": "Face Care", "image": "https://images.unsplash.com/photo-1748543668676-ea8241cb3886?w=800&q=80"},
    {"slug": "hair-care", "name": "Hair Care", "image": "https://images.unsplash.com/photo-1624454002302-36b824d7bd0a?w=800&q=80"},
    {"slug": "body-care", "name": "Body Care", "image": "https://images.unsplash.com/photo-1694539143662-e17d688b4701?w=800&q=80"},
    {"slug": "soaps", "name": "Soaps", "image": "https://images.unsplash.com/photo-1672666037261-4c72d2b84314?w=800&q=80"},
    {"slug": "lip-care", "name": "Lip Care", "image": "https://images.unsplash.com/photo-1599733589046-08b211380a36?w=800&q=80"},
    {"slug": "eye-care", "name": "Eye Care", "image": "https://images.unsplash.com/photo-1631730486572-22b46aa6f8de?w=800&q=80"},
    {"slug": "men", "name": "Men Exclusive", "image": "https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&q=80"},
    {"slug": "kids", "name": "Kids", "image": "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80"},
    {"slug": "foot-care", "name": "Foot Care", "image": "https://images.unsplash.com/photo-1610505687678-d4fd3a8c5bb1?w=800&q=80"},
    {"slug": "pain-relief", "name": "Pain Relief", "image": "https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=800&q=80"},
]

SEED_PRODUCTS = [
    # Face Wash
    {"name": "Charcoal Face Wash", "category": "face-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80", "short_description": "Deep-cleansing charcoal detox for clear, refined skin.", "ingredients": "Activated charcoal, neem, tea tree oil, aloe vera", "benefits": ["Removes impurities", "Controls excess oil", "Minimises pores"]},
    {"name": "Anti-Acne Face Wash", "category": "face-care", "price": 229, "mrp": 279, "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80", "short_description": "Calms breakouts and brightens dull skin.", "ingredients": "Turmeric, neem, salicylic acid (natural), tulsi", "benefits": ["Reduces acne", "Soothes inflammation", "Evens tone"]},
    {"name": "Anti-Acne Face Cream", "category": "face-care", "price": 349, "mrp": 399, "image": "https://images.unsplash.com/photo-1556228852-80b6e5eeff06?w=800&q=80", "short_description": "Lightweight cream that targets active acne overnight.", "ingredients": "Tea tree, kumkumadi, sandalwood, manjistha", "benefits": ["Spot treatment", "Non-comedogenic", "Heals scars"]},
    {"name": "Kachur & Jojoba Oil Cream", "category": "face-care", "price": 399, "mrp": 499, "image": "https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=800&q=80", "short_description": "Anti-pigmentation cream with rare kachur root.", "ingredients": "Kachur, jojoba oil, saffron, milk cream", "benefits": ["Lightens dark spots", "Deep hydration", "Anti-aging"]},
    {"name": "Skin Whitening Cream", "category": "face-care", "price": 449, "mrp": 549, "image": "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&q=80", "short_description": "Brightening cream with saffron & mulethi.", "ingredients": "Saffron, mulethi, sandalwood, vitamin C", "benefits": ["Brightens complexion", "Reduces tan", "Even skin tone"]},
    {"name": "Face Powder", "category": "face-care", "price": 299, "mrp": 349, "image": "https://images.unsplash.com/photo-1631214540242-c3b6ba39cae2?w=800&q=80", "short_description": "Ayurvedic compact for a matte natural finish.", "ingredients": "Rice powder, kaolin clay, sandalwood", "benefits": ["Oil control", "Natural matte", "Soothing"]},

    # Hair Care
    {"name": "Hair Oil", "category": "hair-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1597314020403-7f3eba3b1b30?w=800&q=80", "short_description": "Classic blend for strong, lustrous hair.", "ingredients": "Coconut, sesame, amla, brahmi", "benefits": ["Stops hair fall", "Adds shine", "Scalp nourishment"]},
    {"name": "Ancient Method Hair Oil", "category": "hair-care", "price": 449, "mrp": 549, "image": "https://images.unsplash.com/photo-1620766165457-d49fe83ff7d4?w=800&q=80", "short_description": "Hand-cooked 1000-year-old ayurvedic recipe.", "ingredients": "Bhringraj, hibiscus, neelibhringadi, sesame", "benefits": ["Premature greying", "Promotes growth", "Calms scalp"]},
    {"name": "No More Tears Shampoo", "category": "hair-care", "price": 269, "mrp": 319, "image": "https://images.unsplash.com/photo-1631730486572-22b46aa6f8de?w=800&q=80", "short_description": "Gentle tear-free shampoo for the whole family.", "ingredients": "Shikakai, reetha, aloe vera", "benefits": ["No tears", "Mild lather", "Daily use"]},
    {"name": "Hibiscus Shampoo", "category": "hair-care", "price": 289, "mrp": 339, "image": "https://images.unsplash.com/photo-1599751449128-eb7249c3d6b1?w=800&q=80", "short_description": "Floral cleanser for stronger, fuller hair.", "ingredients": "Hibiscus, fenugreek, amla", "benefits": ["Hair fall control", "Adds volume", "Natural conditioning"]},
    {"name": "Coconut Shampoo", "category": "hair-care", "price": 269, "mrp": 319, "image": "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=800&q=80", "short_description": "Cooling coconut shampoo for dry, brittle hair.", "ingredients": "Virgin coconut, curry leaf, bhringraj", "benefits": ["Deep moisturising", "Reduces frizz", "Cooling"]},
    {"name": "Hair Growth Serum", "category": "hair-care", "price": 549, "mrp": 699, "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80", "short_description": "Daily scalp serum for visibly thicker hair.", "ingredients": "Bhringraj, rosemary, peptides, biotin", "benefits": ["Stimulates roots", "Reduces shedding", "Lightweight"]},
    {"name": "Frizz Free Serum", "category": "hair-care", "price": 399, "mrp": 449, "image": "https://images.unsplash.com/photo-1599751449128-eb7249c3d6b1?w=800&q=80", "short_description": "Smoothing serum for salon-soft hair.", "ingredients": "Argan, almond, jojoba", "benefits": ["Tames frizz", "Adds shine", "Heat protection"]},
    {"name": "Her Shine Hair Pack", "category": "hair-care", "price": 349, "mrp": 399, "image": "https://images.unsplash.com/photo-1626015449398-1d29b9b5e5c5?w=800&q=80", "short_description": "Weekly mask for mirror-shine.", "ingredients": "Henna, shikakai, multani mitti", "benefits": ["Deep nourishment", "Shine boost", "Damage repair"]},
    {"name": "Hair Color Dye", "category": "hair-care", "price": 499, "mrp": 599, "image": "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80", "short_description": "Herbal hair colour without harsh chemicals.", "ingredients": "Henna, indigo, amla, bhringraj", "benefits": ["Ammonia-free", "Covers grey", "Conditions hair"]},
    {"name": "Deep Conditioning Hair Mask", "category": "hair-care", "price": 449, "mrp": 549, "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80", "short_description": "Intense hydration mask for dry strands.", "ingredients": "Avocado, shea butter, hibiscus", "benefits": ["Restores moisture", "Repairs split ends", "Softens"]},

    # Body Care
    {"name": "Baby Massage Oil", "category": "kids", "price": 299, "mrp": 349, "image": "https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80", "short_description": "Gentle warming oil for baby's daily massage.", "ingredients": "Almond, sesame, ashwagandha", "benefits": ["Strengthens bones", "Better sleep", "Soft skin"]},
    {"name": "Body Lotion - Bay Leaf", "category": "body-care", "price": 329, "mrp": 379, "image": "https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?w=800&q=80", "short_description": "Calming bay leaf body lotion for everyday glow.", "ingredients": "Bay leaf, shea butter, almond oil", "benefits": ["24h hydration", "Soothes", "Aromatic"]},
    {"name": "Body Lotion for Kids", "category": "kids", "price": 299, "mrp": 349, "image": "https://images.unsplash.com/photo-1632913571078-c4ed59c3aafd?w=800&q=80", "short_description": "Gentle daily lotion for delicate skin.", "ingredients": "Calendula, shea, aloe vera", "benefits": ["Hypoallergenic", "Soft skin", "All-day care"]},
    {"name": "Talcum Powder", "category": "body-care", "price": 199, "mrp": 249, "image": "https://images.unsplash.com/photo-1610505687678-d4fd3a8c5bb1?w=800&q=80", "short_description": "Cooling herbal talc for fresh comfort.", "ingredients": "Sandalwood, vetiver, khus", "benefits": ["Cooling", "Absorbs sweat", "Light fragrance"]},
    {"name": "Bath Powder", "category": "body-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80", "short_description": "Traditional ubtan for glowing skin.", "ingredients": "Chickpea flour, turmeric, sandalwood, rose", "benefits": ["Natural exfoliation", "Glow", "Removes tan"]},
    {"name": "Under Arm Roll On", "category": "body-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1626015449398-1d29b9b5e5c5?w=800&q=80", "short_description": "Aluminum-free roll-on with kasturi turmeric.", "ingredients": "Kasturi turmeric, alum, witch hazel", "benefits": ["48h freshness", "Lightens", "Skin-friendly"]},

    # Soaps
    {"name": "Tulasi Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://images.unsplash.com/photo-1600857062241-98ae9e8c9509?w=800&q=80", "short_description": "Holy basil soap that purifies & protects.", "ingredients": "Tulsi, coconut oil, neem", "benefits": ["Antibacterial", "Refreshing", "Daily use"]},
    {"name": "ABC Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://images.unsplash.com/photo-1600857062241-98ae9e8c9509?w=800&q=80", "short_description": "Apple-Beetroot-Carrot soap for radiant skin.", "ingredients": "Apple, beetroot, carrot extracts", "benefits": ["Brightens", "Vitamin-rich", "Even tone"]},
    {"name": "Tomato Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://images.unsplash.com/photo-1605193539481-43fb9ad21138?w=800&q=80", "short_description": "Tomato extract soap for tan removal.", "ingredients": "Tomato pulp, vitamin C, sandalwood", "benefits": ["Removes tan", "Brightens", "Antioxidant"]},
    {"name": "Kuppaimeni Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://images.unsplash.com/photo-1635350736475-c8cef4b21906?w=800&q=80", "short_description": "Indian acalypha soap for skin allergies.", "ingredients": "Kuppaimeni, neem, turmeric", "benefits": ["Anti-bacterial", "Calms itch", "Heals"]},
    {"name": "Papaya Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://images.unsplash.com/photo-1600857062241-98ae9e8c9509?w=800&q=80", "short_description": "Enzyme-rich papaya soap for soft skin.", "ingredients": "Papaya, honey, milk", "benefits": ["Gentle exfoliation", "Softens", "Glow"]},
    {"name": "Neem Soap", "category": "soaps", "price": 99, "mrp": 129, "image": "https://images.unsplash.com/photo-1600857062241-98ae9e8c9509?w=800&q=80", "short_description": "Pure neem soap for acne-prone skin.", "ingredients": "Neem, coconut, basil", "benefits": ["Anti-acne", "Antifungal", "Clean skin"]},
    {"name": "Charcoal Soap", "category": "soaps", "price": 119, "mrp": 149, "image": "https://images.unsplash.com/photo-1656431064832-9eb2c0ff97f1?w=800&q=80", "short_description": "Activated charcoal soap deep cleanse.", "ingredients": "Activated charcoal, tea tree, olive oil", "benefits": ["Detoxifies", "Unclogs pores", "Refreshing"]},

    # Lip Care
    {"name": "Pinky Lip Balm", "category": "lip-care", "price": 149, "mrp": 199, "image": "https://images.unsplash.com/photo-1599733589046-08b211380a36?w=800&q=80", "short_description": "Tinted balm for soft pink lips.", "ingredients": "Beetroot, shea butter, beeswax", "benefits": ["Natural tint", "Soft lips", "Sun-kissed"]},
    {"name": "Yellow Fellow Lip Balm", "category": "lip-care", "price": 149, "mrp": 199, "image": "https://images.unsplash.com/photo-1591375372226-1d1abaa7e3fa?w=800&q=80", "short_description": "Saffron-infused balm for healing lips.", "ingredients": "Saffron, honey, almond oil", "benefits": ["Heals dryness", "Glow", "Soothing"]},
    {"name": "Purple Lip Balm", "category": "lip-care", "price": 149, "mrp": 199, "image": "https://images.unsplash.com/photo-1612296727716-89ae47a1b73e?w=800&q=80", "short_description": "Berry balm for plump, lush lips.", "ingredients": "Blueberry, beetroot, vitamin E", "benefits": ["Lip plumping", "Lightens darkness", "Hydration"]},
    {"name": "Lipstick", "category": "lip-care", "price": 349, "mrp": 449, "image": "https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=800&q=80", "short_description": "Herbal lipstick — long-lasting matte.", "ingredients": "Beeswax, castor oil, natural pigments", "benefits": ["No paraben", "Smooth glide", "Rich pigment"]},

    # Serums & Specialty
    {"name": "Skin Glow Serum", "category": "face-care", "price": 549, "mrp": 699, "image": "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&q=80", "short_description": "Daily glow serum with vitamin C & saffron.", "ingredients": "Vitamin C, saffron, hyaluronic acid", "benefits": ["Glow boost", "Anti-pigmentation", "Hydrating"]},
    {"name": "Milk Drop Serum", "category": "face-care", "price": 599, "mrp": 749, "image": "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800&q=80", "short_description": "Milk protein serum for baby-soft skin.", "ingredients": "Milk proteins, kumkumadi, ceramides", "benefits": ["Brightens", "Softens", "Plumping"]},
    {"name": "Goat Milk & Kumkumadi Oil 15mL", "category": "face-care", "price": 699, "mrp": 899, "image": "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=800&q=80", "short_description": "Luxury facial oil blend for night repair.", "ingredients": "Goat milk, kumkumadi, saffron", "benefits": ["Night repair", "Skin brightening", "Anti-aging"]},

    # Eye & Brow
    {"name": "Eyelash & Eyebrow Growth Oil", "category": "eye-care", "price": 349, "mrp": 449, "image": "https://images.unsplash.com/photo-1631730486572-22b46aa6f8de?w=800&q=80", "short_description": "Castor blend for fuller lashes & brows.", "ingredients": "Castor oil, vitamin E, almond", "benefits": ["Lengthens lashes", "Brow growth", "Nourishing"]},
    {"name": "Mascara", "category": "eye-care", "price": 399, "mrp": 499, "image": "https://images.unsplash.com/photo-1631214540242-c3b6ba39cae2?w=800&q=80", "short_description": "Herbal mascara for natural lift.", "ingredients": "Carbon black, beeswax, bhringraj", "benefits": ["Volume", "Smudge-proof", "Conditioning"]},
    {"name": "Kajal", "category": "eye-care", "price": 199, "mrp": 249, "image": "https://images.unsplash.com/photo-1631214540242-c3b6ba39cae2?w=800&q=80", "short_description": "Traditional ayurvedic kajal stick.", "ingredients": "Castor oil, ghee, camphor", "benefits": ["Deep black", "Cools eyes", "Long-stay"]},

    # Men
    {"name": "Beard Oil", "category": "men", "price": 449, "mrp": 549, "image": "https://images.unsplash.com/photo-1621607512214-68297480165e?w=800&q=80", "short_description": "Conditioning beard oil for fuller growth.", "ingredients": "Argan, jojoba, cedarwood", "benefits": ["Softens beard", "Promotes growth", "Tames frizz"]},

    # Foot Care
    {"name": "Foot Crack Cream", "category": "foot-care", "price": 249, "mrp": 299, "image": "https://images.unsplash.com/photo-1610505687678-d4fd3a8c5bb1?w=800&q=80", "short_description": "Heals deep cracks overnight.", "ingredients": "Shea butter, urea, neem", "benefits": ["Repairs cracks", "Softens heels", "Deep moisture"]},

    # Pain Relief
    {"name": "Pain Relief Oil", "category": "pain-relief", "price": 349, "mrp": 449, "image": "https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=800&q=80", "short_description": "Ayurvedic warm oil for joint & muscle relief.", "ingredients": "Mahanarayan, eucalyptus, gandhapura", "benefits": ["Soothes pain", "Improves mobility", "Warming"]},
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

    # Seed categories
    for c in SEED_CATEGORIES:
        await db.categories.update_one({"slug": c["slug"]}, {"$set": c}, upsert=True)

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


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.products.create_index("product_id", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)
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
