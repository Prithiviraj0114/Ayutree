"""Tests for NEW Ayutree features (iteration 2):
- Forgot/Reset password flow
- Object-storage image upload (admin)
- Review submission and product detail listing
- COD checkout + admin order status change (email is no-op with blank RESEND key)
"""
import io
import os
import re
import time
import uuid
import struct
import zlib
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ayutree-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "prithiviraj0114@gmail.com"
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@2026")
RESET_LOG_PATH = "/var/log/supervisor/backend.err.log"


# ---------- helpers ----------
def make_png_bytes() -> bytes:
    """Return a tiny valid 1x1 PNG."""
    # 1x1 transparent PNG
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 6, 0, 0, 0)
    ihdr_chunk = b"IHDR" + ihdr
    ihdr_full = struct.pack(">I", 13) + ihdr_chunk + struct.pack(">I", zlib.crc32(ihdr_chunk) & 0xffffffff)
    raw = b"\x00\x00\x00\x00\x00"
    comp = zlib.compress(raw)
    idat_chunk = b"IDAT" + comp
    idat_full = struct.pack(">I", len(comp)) + idat_chunk + struct.pack(">I", zlib.crc32(idat_chunk) & 0xffffffff)
    iend_chunk = b"IEND"
    iend_full = struct.pack(">I", 0) + iend_chunk + struct.pack(">I", zlib.crc32(iend_chunk) & 0xffffffff)
    return sig + ihdr_full + idat_full + iend_full


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def customer():
    suffix = uuid.uuid4().hex[:8]
    email = f"test_new_{suffix}@ayutree.com"
    password = "Pass@1234"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": password, "name": "New Feat Cust"})
    assert r.status_code == 200, f"register failed: {r.text}"
    d = r.json()
    return {"email": email, "password": password, "token": d["token"], "user_id": d["user_id"]}


@pytest.fixture(scope="module")
def cust_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}"}


# ---------- Forgot/Reset password ----------
class TestForgotResetPassword:
    def test_forgot_existing_user(self, customer):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_forgot_nonexistent_email_no_enum(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nonexistent_{uuid.uuid4().hex[:6]}@ayutree.com"})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_reset_invalid_token(self):
        r = requests.post(f"{API}/auth/reset-password",
                          json={"token": "definitely-not-a-real-token-xxx", "password": "NewPass@123"})
        assert r.status_code == 400

    def test_full_reset_flow_and_no_reuse(self, customer):
        # Trigger forgot to insert a token
        r = requests.post(f"{API}/auth/forgot-password", json={"email": customer["email"]})
        assert r.status_code == 200
        # Allow log flush
        time.sleep(0.7)
        # Find the latest token for this email by scraping the log file
        token = None
        if os.path.exists(RESET_LOG_PATH):
            with open(RESET_LOG_PATH, "r", errors="ignore") as f:
                lines = f.readlines()
            pattern = re.compile(r"\[reset\] " + re.escape(customer["email"]) + r" -> .*token=([A-Za-z0-9_\-]+)")
            for line in reversed(lines[-3000:]):
                m = pattern.search(line)
                if m:
                    token = m.group(1)
                    break
        if not token:
            pytest.skip("Could not find reset token in backend logs (log path/format issue)")
        new_password = "Reset@9876"
        r2 = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": new_password})
        assert r2.status_code == 200, r2.text
        # Old password should no longer work
        r_old = requests.post(f"{API}/auth/login", json={"email": customer["email"], "password": customer["password"]})
        assert r_old.status_code == 401
        # New password should work
        r_new = requests.post(f"{API}/auth/login", json={"email": customer["email"], "password": new_password})
        assert r_new.status_code == 200
        # Update fixture for downstream use (best-effort)
        customer["password"] = new_password
        customer["token"] = r_new.json()["token"]
        # Reuse same token must fail
        r_reuse = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "Another@123"})
        assert r_reuse.status_code == 400


# ---------- Object storage upload ----------
class TestAdminUpload:
    def test_admin_upload_png(self, admin_headers):
        png = make_png_bytes()
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(f"{API}/admin/upload", headers=admin_headers, files=files, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "path" in body and "url" in body
        assert body["url"].startswith("/api/files/")
        # GET the file back
        r2 = requests.get(f"{BASE_URL}{body['url']}", timeout=30)
        assert r2.status_code == 200
        assert r2.headers.get("Content-Type", "").startswith("image/")
        assert r2.content[:8] == b"\x89PNG\r\n\x1a\n"
        # save for product test
        TestAdminUpload._uploaded_url = body["url"]

    def test_customer_cannot_upload(self, cust_headers):
        files = {"file": ("test.png", io.BytesIO(make_png_bytes()), "image/png")}
        r = requests.post(f"{API}/admin/upload", headers=cust_headers, files=files, timeout=60)
        assert r.status_code == 403

    def test_non_image_rejected(self, admin_headers):
        files = {"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(f"{API}/admin/upload", headers=admin_headers, files=files, timeout=60)
        assert r.status_code == 400


# ---------- Reviews ----------
class TestReviews:
    def test_create_review_and_appear_on_pdp(self, cust_headers):
        # Fetch one product
        r = requests.get(f"{API}/products", timeout=30)
        assert r.status_code == 200
        products = r.json()
        assert len(products) > 0
        pid = products[0]["product_id"]
        comment = f"TEST_review_{uuid.uuid4().hex[:6]}"
        rr = requests.post(f"{API}/reviews", headers=cust_headers,
                           json={"product_id": pid, "rating": 5, "comment": comment}, timeout=30)
        assert rr.status_code == 200, rr.text
        rev = rr.json()
        assert rev["product_id"] == pid
        assert rev["rating"] == 5
        assert rev["comment"] == comment
        assert "review_id" in rev
        # GET product detail and ensure review present
        pd = requests.get(f"{API}/products/{pid}", timeout=30)
        assert pd.status_code == 200
        pdata = pd.json()
        assert "reviews" in pdata and isinstance(pdata["reviews"], list)
        assert any(rv.get("comment") == comment for rv in pdata["reviews"])

    def test_review_requires_auth(self):
        r = requests.post(f"{API}/reviews", json={"product_id": "x", "rating": 5, "comment": "no auth"})
        assert r.status_code in (401, 403)


# ---------- Checkout & admin order status (email no-op) ----------
class TestCheckoutAndShipped:
    def _get_pid(self):
        r = requests.get(f"{API}/products", timeout=30)
        assert r.status_code == 200
        return r.json()[0]["product_id"]

    def test_cod_checkout_then_admin_ship(self, cust_headers, admin_headers):
        pid = self._get_pid()
        # add to cart
        rc = requests.post(f"{API}/cart/add", headers=cust_headers, json={"product_id": pid, "qty": 1}, timeout=30)
        assert rc.status_code == 200, rc.text
        # checkout COD
        addr = {
            "full_name": "New Feat Cust",
            "phone": "9999999999",
            "line1": "123 Test Lane",
            "city": "Mumbai",
            "state": "MH",
            "pincode": "400001",
            "country": "IN",
        }
        rch = requests.post(f"{API}/checkout", headers=cust_headers,
                            json={"payment_method": "cod", "address": addr}, timeout=60)
        assert rch.status_code == 200, rch.text
        order = rch.json()
        order_id = order.get("order_id") or order.get("id") or order.get("orderId")
        assert order_id, f"no order_id in response: {order}"
        # Admin patches to shipped
        rp = requests.patch(f"{API}/admin/orders/{order_id}", headers=admin_headers,
                            json={"status": "shipped", "tracking_id": "TRK-TEST-001"}, timeout=30)
        assert rp.status_code == 200, rp.text
        body = rp.json()
        assert body.get("status") == "shipped"
        assert body.get("tracking_id") == "TRK-TEST-001"
        # delivered transition (also email no-op)
        rd = requests.patch(f"{API}/admin/orders/{order_id}", headers=admin_headers,
                            json={"status": "delivered"}, timeout=30)
        assert rd.status_code == 200
        assert rd.json().get("status") == "delivered"
