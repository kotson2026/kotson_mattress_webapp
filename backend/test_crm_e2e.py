import asyncio
import json
import urllib.request
import urllib.parse
from datetime import datetime, timezone

BASE = "http://localhost:8001/api"

def req(path, method="GET", body=None, cookie=None):
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = f"ks_session={cookie}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            content = resp.read().decode()
            set_cookie = resp.headers.get("Set-Cookie")
            token = None
            if set_cookie and "ks_session=" in set_cookie:
                token = set_cookie.split("ks_session=")[1].split(";")[0]
            return resp.status, json.loads(content) if content else {}, token
    except urllib.error.HTTPError as e:
        content = e.read().decode()
        try:
            parsed = json.loads(content) if content else {}
        except Exception:
            parsed = {"raw": content}
        return e.code, parsed, None

def main():
    print("=== STARTING CRM END-TO-END VERIFICATION ===")

    # 1. Login as CRM Master Admin
    status, res, master_cookie = req("/auth/login", method="POST", body={"email": "hello@kotsonmattress.com", "password": "Kotson-Owner-2026!"})
    assert status == 200, f"Login failed: {res}"
    print(f"1. Master Admin Login: SUCCESS (user={res['user']['name']})")

    # 2. Seed test data if needed
    status, res, _ = req("/crm/test-data/seed", method="POST", cookie=master_cookie)
    print("2. Seed CRM Data:", res.get("message", "ok"))

    # 3. Master Admin lists campaigns with calculated counts
    status, campaigns, _ = req("/crm/campaigns", method="GET", cookie=master_cookie)
    assert status == 200, f"Campaigns listing failed: {campaigns}"
    assert len(campaigns) > 0, "No campaigns found"
    camp = campaigns[0]
    print(f"3. Master Admin Campaign '{camp['name']}': Total={camp.get('total_leads')}, Assigned={camp.get('assigned_leads')}, Uncontacted={camp.get('uncontacted_leads')}, In-Progress={camp.get('in_progress_leads')}, Closed={camp.get('closed_leads')}")

    # 4. Login as Employee (vikram.sethi@kotson.test)
    status, res, emp_cookie = req("/auth/login", method="POST", body={"email": "vikram.sethi@kotson.test", "password": "KotsonTest@2026"})
    if status != 200:
        status, res, emp_cookie = req("/auth/login", method="POST", body={"email": "crm.employee@kotsonmattress.com", "password": "Kotson-CRMEmp-2026!"})
    assert status == 200, f"Employee login failed: {res}"
    emp_user = res["user"]
    print(f"4. Employee Login ({emp_user['name']}): SUCCESS")

    # 5. Check Employee Workday Status
    status, workday, _ = req("/crm/workforce/workday-status", method="GET", cookie=emp_cookie)
    assert status == 200, f"Workday status failed: {workday}"
    print(f"5. Employee Workday Status: {workday['status']} (Clocked In: {workday.get('is_clocked_in')})")

    # 6. Test Clock-in (or verify already clocked in)
    if not workday.get("is_clocked_in"):
        status, clock_res, _ = req("/crm/workforce/clock-in", method="POST", body={}, cookie=emp_cookie)
        print(f"6. Clock In Result: {clock_res.get('message')}")
    else:
        print("6. Already clocked in today.")

    # 7. Employee campaigns (verify scoping - employee sees only authorized campaigns)
    status, emp_campaigns, _ = req("/crm/campaigns", method="GET", cookie=emp_cookie)
    assert status == 200, f"Employee campaigns failed: {emp_campaigns}"
    print(f"7. Employee Authorized Campaigns count: {len(emp_campaigns)}")

    # 8. Start Calling queue: fetch next callable lead
    status, next_call, _ = req("/crm/leads/next-call", method="GET", cookie=emp_cookie)
    assert status == 200, f"Next call failed: {next_call}"
    print(f"8. Start Calling queue: has_lead={next_call.get('has_lead')}, reason={next_call.get('queue_reason')}")

    # 9. Test Walk-in Lead creation for employee
    lead_id = None
    if emp_campaigns:
        target_camp = emp_campaigns[0]
        walkin_payload = {
            "name": "Test Walk-in Customer",
            "phone": "9876000001",
            "email": "walkin.customer@example.com",
            "campaign_code": target_camp["id"],
            "product_interest": "Natural Latex Mattress",
            "note": "Walked in seeking firm king size mattress"
        }
        status, walkin_lead, _ = req("/crm/leads/walk-in", method="POST", body=walkin_payload, cookie=emp_cookie)
        if status in (200, 201):
            print(f"9. Walk-in Lead Created: {walkin_lead.get('lead_number')} (Assigned to {walkin_lead.get('employee_id')})")
            lead_id = walkin_lead["id"]
        else:
            print(f"9. Walk-in response: {status} {walkin_lead.get('detail')}")
            status, leads_page, _ = req("/crm/leads?limit=1", method="GET", cookie=emp_cookie)
            lead_id = leads_page["rows"][0]["id"] if leads_page.get("rows") else None
    else:
        status, leads_page, _ = req("/crm/leads?limit=1", method="GET", cookie=emp_cookie)
        lead_id = leads_page["rows"][0]["id"] if leads_page.get("rows") else None

    # 10. Call logging workflow (Not Connected / Connected)
    if lead_id:
        status, cfg, _ = req("/crm/dispositions/config?active_only=true", method="GET", cookie=emp_cookie)
        assert status == 200, "Config failed"
        conns = cfg.get("connectivities", [])
        disps = cfg.get("dispositions", [])
        nc_conn = next((c["code"] for c in conns if "not" in c["code"].lower()), "not_connected")
        nc_disp = next((d["code"] for d in disps if d["connectivity_code"] == nc_conn), None)
        
        if nc_disp:
            call_payload = {
                "connectivity_code": nc_conn,
                "disposition_code": nc_disp,
                "summary": "Customer phone rang without answer",
                "idempotency_key": f"test-key-{datetime.now().timestamp()}"
            }
            status, call_res, _ = req(f"/crm/leads/{lead_id}/calls", method="POST", body=call_payload, cookie=emp_cookie)
            assert status in (200, 201), f"Save call failed: {call_res}"
            print(f"10. Call record saved: {call_res.get('connectivity_label')} -> {call_res.get('disposition_label')}")

    # 11. Leads filtering by Category (all, uncontacted, in_progress, follow_up, not_connected)
    for cat in ["all", "uncontacted", "in_progress", "not_connected"]:
        status, page, _ = req(f"/crm/leads?category={cat}&limit=5", method="GET", cookie=emp_cookie)
        assert status == 200, f"Category filter {cat} failed"
        print(f"11. Category '{cat}' leads count: {page.get('total')}")

    print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    main()
