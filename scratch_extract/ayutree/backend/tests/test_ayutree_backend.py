"""Comprehensive backend tests for Ayutree e-commerce API.
Covers: products, categories, auth, cart, wishlist, checkout (cod + razorpay sim), admin.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ayutree-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@ayutree.com"
ADMIN_PASSWORD = "Admin@2026"


# -----------------------------
# Fixtures
# -----------------------------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="session")
def customer(s):
    """Register a fresh test customer."""
    suffix = uuid.uuid4().hex[:8]
    email = f"test_cust_{suffix}@ayutree.com"
    payload = {"email": email, "password": "Pass@1234", "name": "Test Cust"}
    r = s.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    d = r.json()
    assert d["email"] == email
    assert d["role"] == "customer"
    assert d["token"]
    return {"email": email, "password": "Pass@1234", "token": d["token"], "user_id": d["user_id"]}


@pytest.fixture(scope="session")
def cust_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}"}


# -----------------------------
# Public: Categories & Products
# -----------------------------
def test_categories_returns_10(s):
    r = s.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    assert isinstance(cats, list)
    assert len(cats) == 10, f"expected 10 categories got {len(cats)}"
    slugs = {c["slug"] for c in cats}
    assert "face-care" in slugs and "hair-care" in slugs


def test_products_returns_at_least_41(s):
    r = s.get(f"{API}/products")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 41, f"expected >=41 products, got {len(items)}"
    p = items[0]
    for k in ("product_id", "name", "price", "category"):
        assert k in p


def test_products_filter_category(s):
    r = s.get(f"{API}/products", params={"category": "face-care"})
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    assert all(p["category"] == "face-care" for p in items)


def test_products_filter_q(s):
    r = s.get(f"{API}/products", params={"q": "charcoal"})
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    assert any("charcoal" in p["name"].lower() or "charcoal" in p.get("description", "").lower() for p in items)


def test_products_featured(s):
    r = s.get(f"{API}/products", params={"featured": "true"})
    assert r.status_code == 200
    items = r.json()
    assert len(items) > 0
    assert all(p.get("featured") is True for p in items)


def test_product_detail_has_reviews_list(s):
    items = s.get(f"{API}/products").json()
    pid = items[0]["product_id"]
    r = s.get(f"{API}/products/{pid}")
    assert r.status_code == 200
    d = r.json()
    assert d["product_id"] == pid
    assert "reviews" in d and isinstance(d["reviews"], list)


def test_product_detail_404(s):
    r = s.get(f"{API}/products/nope_xyz")
    assert r.status_code == 404


# -----------------------------
# Auth
# -----------------------------
def test_auth_me_with_bearer(s, customer, cust_headers):
    r = s.get(f"{API}/auth/me", headers=cust_headers)
    assert r.status_code == 200
    me = r.json()
    assert me["email"] == customer["email"]
    assert me["role"] == "customer"
    assert "password_hash" not in me
    assert "_id" not in me


def test_auth_me_unauthenticated():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_admin_login_role(admin_token):
    assert admin_token  # already validated


def test_login_invalid_password(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_register_duplicate_email(s, customer):
    r = s.post(f"{API}/auth/register", json={"email": customer["email"], "password": "x", "name": "x"})
    assert r.status_code == 400


# -----------------------------
# Cart
# -----------------------------
@pytest.fixture(scope="session")
def sample_products(s):
    items = s.get(f"{API}/products").json()
    return items


def test_cart_flow(s, cust_headers, sample_products):
    p1 = sample_products[0]
    p2 = sample_products[1]
    # Add p1
    r = s.post(f"{API}/cart/add", json={"product_id": p1["product_id"], "qty": 2}, headers=cust_headers)
    assert r.status_code == 200
    # Add p2
    r = s.post(f"{API}/cart/add", json={"product_id": p2["product_id"], "qty": 1}, headers=cust_headers)
    assert r.status_code == 200
    # Get cart
    r = s.get(f"{API}/cart", headers=cust_headers)
    assert r.status_code == 200
    cart = r.json()
    ids = {it["product_id"] for it in cart["items"]}
    assert p1["product_id"] in ids and p2["product_id"] in ids
    # Each item enriched with product
    for it in cart["items"]:
        assert "product" in it and it["product"]["name"]
    # Update qty
    r = s.post(f"{API}/cart/update", json={"product_id": p1["product_id"], "qty": 5}, headers=cust_headers)
    assert r.status_code == 200
    cart = s.get(f"{API}/cart", headers=cust_headers).json()
    p1_item = next(it for it in cart["items"] if it["product_id"] == p1["product_id"])
    assert p1_item["qty"] == 5
    # Remove p2
    r = s.delete(f"{API}/cart/{p2['product_id']}", headers=cust_headers)
    assert r.status_code == 200
    cart = s.get(f"{API}/cart", headers=cust_headers).json()
    assert p2["product_id"] not in {it["product_id"] for it in cart["items"]}


def test_cart_requires_auth():
    r = requests.get(f"{API}/cart")
    assert r.status_code == 401


# -----------------------------
# Wishlist
# -----------------------------
def test_wishlist_toggle(s, cust_headers, sample_products):
    pid = sample_products[3]["product_id"]
    r = s.post(f"{API}/wishlist/toggle/{pid}", headers=cust_headers)
    assert r.status_code == 200
    d = r.json()
    assert d["added"] is True
    assert pid in d["product_ids"]
    # toggle again removes
    r = s.post(f"{API}/wishlist/toggle/{pid}", headers=cust_headers)
    assert r.json()["added"] is False
    assert pid not in r.json()["product_ids"]


# -----------------------------
# Checkout (COD)
# -----------------------------
@pytest.fixture
def stocked_cart(s, cust_headers, sample_products):
    """Ensure customer's cart has at least one item for checkout tests."""
    pid = sample_products[0]["product_id"]
    s.post(f"{API}/cart/add", json={"product_id": pid, "qty": 1}, headers=cust_headers)
    return pid


def _address():
    return {
        "full_name": "Test User",
        "phone": "9999999999",
        "line1": "1 Test Street",
        "line2": "",
        "city": "Bangalore",
        "state": "KA",
        "pincode": "560001",
        "country": "India",
    }


def test_checkout_cod(s, cust_headers, stocked_cart):
    r = s.post(f"{API}/checkout", json={"address": _address(), "payment_method": "cod"}, headers=cust_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["order_id"].startswith("AYU")
    assert d["total"] > 0
    assert d["razorpay"] is None
    # cart cleared
    cart = s.get(f"{API}/cart", headers=cust_headers).json()
    assert cart["items"] == []
    # appears in orders
    orders = s.get(f"{API}/orders", headers=cust_headers).json()
    assert any(o["order_id"] == d["order_id"] for o in orders)


def test_checkout_empty_cart_400(s, cust_headers):
    # cart cleared by previous test
    r = s.post(f"{API}/checkout", json={"address": _address(), "payment_method": "cod"}, headers=cust_headers)
    assert r.status_code == 400


def test_checkout_razorpay_simulated_and_verify(s, cust_headers, stocked_cart):
    r = s.post(f"{API}/checkout", json={"address": _address(), "payment_method": "razorpay"}, headers=cust_headers)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["razorpay"] is not None
    assert d["razorpay"]["id"].startswith("order_")
    assert d["key_id"]  # placeholder string
    # verify
    vr = s.post(f"{API}/payments/verify", json={
        "order_id": d["order_id"],
        "razorpay_order_id": d["razorpay"]["id"],
        "razorpay_payment_id": f"pay_sim_{uuid.uuid4().hex[:8]}",
        "razorpay_signature": "sim_sig",
    }, headers=cust_headers)
    assert vr.status_code == 200, vr.text
    # order paid
    orders = s.get(f"{API}/orders", headers=cust_headers).json()
    o = next(o for o in orders if o["order_id"] == d["order_id"])
    assert o["payment_status"] == "paid"
    assert o["status"] == "placed"


# -----------------------------
# Admin
# -----------------------------
def test_admin_endpoints_reject_non_admin(customer):
    # Use a fresh session to avoid any stale cookies from other tests
    headers = {"Authorization": f"Bearer {customer['token']}"}
    for path in ("/admin/stats", "/admin/orders", "/admin/customers"):
        r = requests.get(f"{API}{path}", headers=headers)
        assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"


def test_admin_stats(s, admin_headers):
    r = s.get(f"{API}/admin/stats", headers=admin_headers)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_orders", "total_customers", "total_products", "revenue", "sales_chart", "top_products", "low_stock"):
        assert k in d
    assert d["total_products"] >= 41
    assert len(d["sales_chart"]) == 7


def test_admin_orders_list(s, admin_headers):
    r = s.get(f"{API}/admin/orders", headers=admin_headers)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_update_order_status(s, admin_headers, cust_headers, sample_products):
    # create a new order to update
    s.post(f"{API}/cart/add", json={"product_id": sample_products[2]["product_id"], "qty": 1}, headers=cust_headers)
    co = s.post(f"{API}/checkout", json={"address": _address(), "payment_method": "cod"}, headers=cust_headers)
    oid = co.json()["order_id"]
    r = s.patch(f"{API}/admin/orders/{oid}", json={"status": "shipped", "tracking_id": "TRACK123"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "shipped"
    assert r.json()["tracking_id"] == "TRACK123"


def test_admin_customers(s, admin_headers, customer):
    r = s.get(f"{API}/admin/customers", headers=admin_headers)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    assert any(u["email"] == customer["email"] for u in users)
    me = next(u for u in users if u["email"] == customer["email"])
    assert "orders_count" in me and "total_spend" in me
    assert "password_hash" not in me


def test_admin_product_crud_requires_admin(customer):
    headers = {"Authorization": f"Bearer {customer['token']}"}
    r = requests.post(f"{API}/admin/products", json={
        "name": "TEST_NoAuth", "category": "face-care", "price": 100
    }, headers=headers)
    assert r.status_code == 403


def test_admin_product_create_update_delete(s, admin_headers):
    # create
    body = {
        "name": "TEST_AdminProd",
        "category": "face-care",
        "price": 199.0,
        "short_description": "test",
        "benefits": ["a", "b"],
        "image": "https://example.com/x.jpg",
        "featured": False,
    }
    r = s.post(f"{API}/admin/products", json=body, headers=admin_headers)
    assert r.status_code == 200, r.text
    p = r.json()
    pid = p["product_id"]
    assert p["name"] == "TEST_AdminProd"
    assert p["price"] == 199.0
    # GET to verify persistence
    pg = s.get(f"{API}/products/{pid}").json()
    assert pg["name"] == "TEST_AdminProd"
    # update
    r = s.patch(f"{API}/admin/products/{pid}", json={"price": 249.0, "name": "TEST_AdminProd2"}, headers=admin_headers)
    assert r.status_code == 200
    assert r.json()["price"] == 249.0
    # delete
    r = s.delete(f"{API}/admin/products/{pid}", headers=admin_headers)
    assert r.status_code == 200
    r = s.get(f"{API}/products/{pid}")
    assert r.status_code == 404
