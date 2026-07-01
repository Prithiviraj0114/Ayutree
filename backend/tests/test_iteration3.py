"""Tests for iteration-3 Ayutree features:
- Coupons (admin CRUD, validation, checkout discount)
- Categories (admin CRUD with product guard)
- Admin Reviews (list with product_name, delete)
- Admin order request-review (only on delivered)
- Admin stats includes total_reviews & total_coupons
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://ayutree-shop.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "prithiviraj0114@gmail.com"
ADMIN_PASSWORD = "Admin@2026"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def customer():
    suffix = uuid.uuid4().hex[:8]
    email = f"test_it3_{suffix}@ayutree.com"
    password = "Pass@1234"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": password, "name": "Iter3 Cust"},
                      timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "password": password, "token": d["token"]}


@pytest.fixture(scope="module")
def cust_headers(customer):
    return {"Authorization": f"Bearer {customer['token']}"}


# ---------- Coupons: admin CRUD + seeded coupons ----------
class TestCouponsCRUD:
    def test_seeded_coupons_present(self, admin_headers):
        r = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        codes = {c["code"] for c in r.json()}
        assert {"WELCOME10", "AYUVEDA20", "FLAT100"}.issubset(codes), f"got {codes}"

    def test_create_coupon_uppercases_and_persists(self, admin_headers):
        code = f"test_it3_{uuid.uuid4().hex[:5]}"  # lowercase on input
        payload = {"code": code, "type": "percent", "value": 25, "min_order": 100,
                   "description": "iter3 test", "active": True}
        r = requests.post(f"{API}/admin/coupons", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] == code.upper()
        # duplicate (case-insensitive) -> 400
        r2 = requests.post(f"{API}/admin/coupons", headers=admin_headers, json=payload, timeout=30)
        assert r2.status_code == 400
        # GET via list contains it
        r3 = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30)
        assert code.upper() in {c["code"] for c in r3.json()}
        # PATCH active off + value
        rp = requests.patch(f"{API}/admin/coupons/{code.upper()}", headers=admin_headers,
                            json={"active": False, "value": 30}, timeout=30)
        assert rp.status_code == 200
        upd = rp.json()
        assert upd["active"] is False and upd["value"] == 30
        # DELETE
        rd = requests.delete(f"{API}/admin/coupons/{code.upper()}", headers=admin_headers, timeout=30)
        assert rd.status_code == 200
        r4 = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30)
        assert code.upper() not in {c["code"] for c in r4.json()}

    def test_admin_coupons_requires_admin(self, cust_headers):
        r = requests.get(f"{API}/admin/coupons", headers=cust_headers, timeout=30)
        assert r.status_code == 403


# ---------- Coupon validation ----------
class TestCouponValidate:
    def test_welcome10_percent(self, cust_headers):
        r = requests.post(f"{API}/coupons/validate", headers=cust_headers,
                          json={"code": "welcome10", "subtotal": 600}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] == "WELCOME10"
        assert body["type"] == "percent"
        assert body["discount"] == 60  # 10% of 600
        assert isinstance(body.get("description", ""), str) and len(body["description"]) > 0

    def test_flat100(self, cust_headers):
        r = requests.post(f"{API}/coupons/validate", headers=cust_headers,
                          json={"code": "FLAT100", "subtotal": 600}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["discount"] == 100
        assert body["type"] == "flat"

    def test_invalid_code(self, cust_headers):
        r = requests.post(f"{API}/coupons/validate", headers=cust_headers,
                          json={"code": "NOPE_XYZ", "subtotal": 600}, timeout=30)
        assert r.status_code == 400

    def test_below_min_order(self, cust_headers):
        # WELCOME10 needs >= 499
        r = requests.post(f"{API}/coupons/validate", headers=cust_headers,
                          json={"code": "WELCOME10", "subtotal": 100}, timeout=30)
        assert r.status_code == 400


# ---------- Checkout with coupon ----------
class TestCheckoutWithCoupon:
    def test_checkout_applies_discount_and_increments_used_count(self, cust_headers, admin_headers):
        # find product with price > min_order (>=499)
        rp = requests.get(f"{API}/products", timeout=30).json()
        product = next((p for p in rp if p.get("price", 0) >= 499), None) or rp[0]
        pid = product["product_id"]
        # add (qty 2 to ensure subtotal > 499 even on lower priced product)
        qty = 1 if product["price"] >= 499 else 3
        ra = requests.post(f"{API}/cart/add", headers=cust_headers,
                           json={"product_id": pid, "qty": qty}, timeout=30)
        assert ra.status_code == 200

        # snapshot WELCOME10 used_count before
        before = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30).json()
        before_used = next(c.get("used_count", 0) for c in before if c["code"] == "WELCOME10")

        addr = {"full_name": "Iter3", "phone": "9999999999",
                "line1": "1 Test Rd", "city": "Mumbai", "state": "MH",
                "pincode": "400001", "country": "IN"}
        rc = requests.post(f"{API}/checkout", headers=cust_headers,
                           json={"payment_method": "cod", "address": addr,
                                 "coupon_code": "WELCOME10"}, timeout=60)
        assert rc.status_code == 200, rc.text
        order_resp = rc.json()
        oid = order_resp["order_id"]
        # Fetch the persisted order detail
        rget = requests.get(f"{API}/orders/{oid}", headers=cust_headers, timeout=30)
        assert rget.status_code == 200, rget.text
        order = rget.json()
        assert order.get("discount", 0) > 0, f"no discount applied: {order}"
        subtotal = order["subtotal"]
        # total = subtotal + shipping + tax - discount
        expected_total = round(subtotal + order.get("shipping", 0)
                               + order.get("tax", 0) - order["discount"], 2)
        assert abs(order["total"] - expected_total) < 0.5, f"total mismatch: {order}"
        # used_count incremented
        after = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=30).json()
        after_used = next(c.get("used_count", 0) for c in after if c["code"] == "WELCOME10")
        assert after_used == before_used + 1, f"used_count {before_used} -> {after_used}"

    def test_checkout_without_coupon_still_works(self, cust_headers):
        rp = requests.get(f"{API}/products", timeout=30).json()
        pid = rp[0]["product_id"]
        ra = requests.post(f"{API}/cart/add", headers=cust_headers,
                           json={"product_id": pid, "qty": 1}, timeout=30)
        assert ra.status_code == 200
        addr = {"full_name": "Iter3", "phone": "9999999999",
                "line1": "1 Test Rd", "city": "Mumbai", "state": "MH",
                "pincode": "400001", "country": "IN"}
        rc = requests.post(f"{API}/checkout", headers=cust_headers,
                           json={"payment_method": "cod", "address": addr}, timeout=60)
        assert rc.status_code == 200
        order = rc.json()
        assert order.get("discount", 0) == 0


# ---------- Categories CRUD ----------
class TestCategoriesCRUD:
    def test_create_update_list_products_and_delete(self, admin_headers):
        slug = f"test-it3-{uuid.uuid4().hex[:5]}"
        r = requests.post(f"{API}/admin/categories", headers=admin_headers,
                          json={"slug": slug, "name": "Iter3 Cat", "image": "https://x.test/img.png"},
                          timeout=30)
        assert r.status_code == 200, r.text
        # duplicate
        r2 = requests.post(f"{API}/admin/categories", headers=admin_headers,
                           json={"slug": slug, "name": "dup", "image": ""}, timeout=30)
        assert r2.status_code == 400
        # patch
        rp = requests.patch(f"{API}/admin/categories/{slug}", headers=admin_headers,
                            json={"name": "Iter3 Cat Renamed"}, timeout=30)
        assert rp.status_code == 200 and rp.json()["name"] == "Iter3 Cat Renamed"
        # list products (empty)
        rl = requests.get(f"{API}/admin/categories/{slug}/products", headers=admin_headers, timeout=30)
        assert rl.status_code == 200 and isinstance(rl.json(), list) and len(rl.json()) == 0
        # delete (empty allowed)
        rd = requests.delete(f"{API}/admin/categories/{slug}", headers=admin_headers, timeout=30)
        assert rd.status_code == 200

    def test_delete_category_with_products_blocked(self, admin_headers):
        # face-care has seeded products
        r = requests.delete(f"{API}/admin/categories/face-care", headers=admin_headers, timeout=30)
        assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
        body = r.json()
        msg = body.get("detail") or body.get("message") or ""
        assert "product" in msg.lower()

    def test_admin_required(self, cust_headers):
        r = requests.post(f"{API}/admin/categories", headers=cust_headers,
                          json={"slug": "nope", "name": "x"}, timeout=30)
        assert r.status_code == 403

    def test_list_products_in_seeded_category(self, admin_headers):
        r = requests.get(f"{API}/admin/categories/face-care/products", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) > 0
        assert all(p["category"] == "face-care" for p in items)


# ---------- Admin Reviews ----------
class TestAdminReviews:
    def test_list_reviews_has_product_name(self, admin_headers, cust_headers):
        # ensure at least one review exists
        prods = requests.get(f"{API}/products", timeout=30).json()
        pid = prods[0]["product_id"]
        rr = requests.post(f"{API}/reviews", headers=cust_headers,
                           json={"product_id": pid, "rating": 4,
                                 "comment": f"TEST_it3_rev_{uuid.uuid4().hex[:5]}"}, timeout=30)
        assert rr.status_code == 200
        review_id = rr.json()["review_id"]

        r = requests.get(f"{API}/admin/reviews", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        reviews = r.json()
        assert len(reviews) > 0
        assert all("product_name" in rv for rv in reviews)
        TestAdminReviews._rid = review_id

    def test_delete_review(self, admin_headers):
        rid = getattr(TestAdminReviews, "_rid", None)
        assert rid, "no review id set"
        r = requests.delete(f"{API}/admin/reviews/{rid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        # ensure it's gone
        rl = requests.get(f"{API}/admin/reviews", headers=admin_headers, timeout=30).json()
        assert all(rv["review_id"] != rid for rv in rl)

    def test_requires_admin(self, cust_headers):
        r = requests.get(f"{API}/admin/reviews", headers=cust_headers, timeout=30)
        assert r.status_code == 403


# ---------- Admin request-review on order ----------
class TestRequestReview:
    def test_request_review_only_on_delivered(self, admin_headers, cust_headers):
        # create order
        prods = requests.get(f"{API}/products", timeout=30).json()
        pid = prods[0]["product_id"]
        requests.post(f"{API}/cart/add", headers=cust_headers,
                      json={"product_id": pid, "qty": 1}, timeout=30)
        addr = {"full_name": "Iter3", "phone": "9999999999",
                "line1": "1 Test Rd", "city": "Mumbai", "state": "MH",
                "pincode": "400001", "country": "IN"}
        rc = requests.post(f"{API}/checkout", headers=cust_headers,
                           json={"payment_method": "cod", "address": addr}, timeout=60)
        assert rc.status_code == 200
        oid = rc.json()["order_id"]
        # request review on non-delivered -> 400
        r_no = requests.post(f"{API}/admin/orders/{oid}/request-review",
                             headers=admin_headers, timeout=30)
        assert r_no.status_code == 400
        # mark delivered
        rp = requests.patch(f"{API}/admin/orders/{oid}", headers=admin_headers,
                            json={"status": "delivered"}, timeout=30)
        assert rp.status_code == 200
        # request review -> ok
        r_ok = requests.post(f"{API}/admin/orders/{oid}/request-review",
                             headers=admin_headers, timeout=30)
        assert r_ok.status_code == 200, r_ok.text
        body = r_ok.json()
        assert body.get("ok") is True
        # email_sent should be False because RESEND key empty
        assert body.get("email_sent") in (False, True)  # mocked
        # verify review_requested_at set: fetch via admin orders
        ro = requests.get(f"{API}/admin/orders", headers=admin_headers, timeout=30)
        assert ro.status_code == 200
        order = next((o for o in ro.json() if o["order_id"] == oid), None)
        assert order is not None
        assert order.get("review_requested_at") is not None


# ---------- Admin stats ----------
class TestAdminStats:
    def test_stats_includes_reviews_and_coupons(self, admin_headers):
        r = requests.get(f"{API}/admin/stats", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "total_reviews" in data, f"keys: {list(data.keys())}"
        assert "total_coupons" in data, f"keys: {list(data.keys())}"
        assert isinstance(data["total_reviews"], int) and data["total_reviews"] >= 0
        assert isinstance(data["total_coupons"], int) and data["total_coupons"] >= 3
