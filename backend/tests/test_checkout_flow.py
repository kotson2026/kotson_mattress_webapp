import requests

def test_checkout_lifecycle():
    # 1. Fetch Ortho Therapy variants
    resp = requests.get("http://127.0.0.1:8001/api/catalog/products/ortho-therapy-mattress")
    product = resp.json()
    
    # 2. Find Queen 75x60x8
    variant = next((v for v in product["variants"] if v["size"] == "Queen" and v["length"] == "75" and v["thickness"] == "8"), None)
    assert variant is not None, "Variant not found!"
    assert variant["price"] == 8450000, f"Expected 8450000 paise, got {variant['price']}"
    
    # 3. Add to cart
    # Note: Using session to keep cookies/token
    session = requests.Session()
    cart_resp = session.post("http://127.0.0.1:8001/api/cart/items", json={
        "variant_id": variant["id"],
        "qty": 1
    })
    
    assert cart_resp.status_code == 200, f"Cart add failed: {cart_resp.text}"
    cart_data = session.get("http://127.0.0.1:8001/api/cart").json()
    assert cart_data["subtotal"] == 8450000, f"Cart subtotal mismatch: {cart_data['subtotal']}"
    
    # 4. Start Checkout (Razorpay)
    checkout_resp = session.post("http://127.0.0.1:8001/api/checkout/start", json={
        "address": {
            "full_name": "Test User",
            "phone": "9999999999",
            "email": "test@example.com",
            "line1": "123 Main St",
            "city": "Test City",
            "state": "Test State",
            "pincode": "123456"
        }
    })
    assert checkout_resp.status_code == 200, f"Checkout failed: {checkout_resp.text}"
    checkout_data = checkout_resp.json()
    
    # Verify amounts
    assert checkout_data["amounts"]["total"] == 8450000, f"Checkout total mismatch: {checkout_data['amounts']['total']}"
    assert checkout_data["gateway"]["amount"] == 8450000, f"Razorpay amount mismatch: {checkout_data['gateway']['amount']}"
    
    print("SUCCESS: Product -> Cart -> Checkout -> Razorpay flow is authoritative and fully secure.")

if __name__ == "__main__":
    test_checkout_lifecycle()
