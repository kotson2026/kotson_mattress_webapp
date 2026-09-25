"""Realistic CRM Test Data Generator & Safe Purge Utility.

Generates realistic Kotson Mattress CRM test data for testing and demonstrations.
All generated records are strictly stamped with `is_test_data = True`.
Purge utility safely and exclusively purges records where `is_test_data == True`.
"""

import uuid
from datetime import datetime, timedelta, timezone

from lib.db import db
from lib.security import hash_password, now_utc
from models.crm import (
    Campaign,
    FollowUp,
    Lead,
    Pipeline,
    Stage,
)
from models.crm_workforce import (
    AttendanceSession,
    BreakRecord,
    LeaveRequest,
    PayrollPeriod,
    PayrollRecord,
)

IST = timezone(timedelta(hours=5, minutes=30))


async def has_active_test_data() -> bool:
    """Checks if any test data is currently active."""
    c1 = await db.leads.count_documents({"is_test_data": True})
    c2 = await db.attendance_sessions.count_documents({"is_test_data": True})
    c3 = await db.pipelines.count_documents({"is_test_data": True})
    return (c1 + c2 + c3) > 0


async def purge_test_data() -> dict:
    """Safely purges ONLY records stamped with is_test_data = True."""
    res_leads = await db.leads.delete_many({"is_test_data": True})
    res_calls = await db.calls.delete_many({"is_test_data": True})
    res_fus = await db.follow_ups.delete_many({"is_test_data": True})
    res_notes = await db.crm_notes.delete_many({"is_test_data": True})
    res_pipes = await db.pipelines.delete_many({"is_test_data": True})
    res_camps = await db.campaigns.delete_many({"is_test_data": True})
    res_att = await db.attendance_sessions.delete_many({"is_test_data": True})
    res_corr = await db.attendance_corrections.delete_many({"is_test_data": True})
    res_leave = await db.leave_requests.delete_many({"is_test_data": True})
    res_pay_rec = await db.payroll_records.delete_many({"is_test_data": True})
    res_pay_per = await db.payroll_periods.delete_many({"is_test_data": True})
    res_orders = await db.orders.delete_many({"is_test_data": True})
    res_users = await db.users.delete_many({"is_test_data": True})
    
    return {
        "leads_deleted": res_leads.deleted_count,
        "calls_deleted": res_calls.deleted_count,
        "follow_ups_deleted": res_fus.deleted_count,
        "pipelines_deleted": res_pipes.deleted_count,
        "campaigns_deleted": res_camps.deleted_count,
        "attendance_deleted": res_att.deleted_count,
        "leave_deleted": res_leave.deleted_count,
        "payroll_deleted": res_pay_rec.deleted_count + res_pay_per.deleted_count,
        "orders_deleted": res_orders.deleted_count,
        "test_users_deleted": res_users.deleted_count,
    }


async def seed_realistic_crm_test_data() -> dict:
    """Seeds realistic Kotson CRM records with is_test_data = True."""
    # First purge any previous test data
    await purge_test_data()
    
    now = now_utc()
    today_str = datetime.now(timezone.utc).astimezone(IST).strftime("%Y-%m-%d")
    
    # 1. Staff: 2 Managers, 3 Employees
    managers_data = [
        {"id": "mgr-rajesh-01", "name": "Rajesh Sharma", "email": "rajesh.sharma@kotson.test", "roles": ["crm_manager"], "phone": "9811001122"},
        {"id": "mgr-ananya-02", "name": "Ananya Iyer", "email": "ananya.iyer@kotson.test", "roles": ["crm_manager"], "phone": "9822002233"},
    ]
    employees_data = [
        {"id": "emp-vikram-01", "name": "Vikram Sethi", "email": "vikram.sethi@kotson.test", "roles": ["crm_employee"], "reporting_to": "mgr-rajesh-01", "crm_manager_id": "mgr-rajesh-01", "phone": "9833003344"},
        {"id": "emp-priya-02", "name": "Priya Nair", "email": "priya.nair@kotson.test", "roles": ["crm_employee"], "reporting_to": "mgr-rajesh-01", "crm_manager_id": "mgr-rajesh-01", "phone": "9844004455"},
        {"id": "emp-amit-03", "name": "Amit Deshmukh", "email": "amit.deshmukh@kotson.test", "roles": ["crm_employee"], "reporting_to": "mgr-ananya-02", "crm_manager_id": "mgr-ananya-02", "phone": "9855005566"},
    ]
    
    for u in managers_data + employees_data:
        doc = {
            "id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "phone": u["phone"],
            "roles": u["roles"],
            "reporting_to": u.get("reporting_to"),
            "crm_manager_id": u.get("crm_manager_id"),
            "department": "Customer Experience",
            "designation": "Sales Specialist",
            "password_hash": hash_password("KotsonTest@2026"),
            "is_active": True,
            "is_test_data": True,
            "created_at": now - timedelta(days=60),
        }
        await db.users.insert_one(doc)

    # 2. Pipelines (5 product-oriented pipelines)
    pipeline_configs = [
        {
            "id": "pipe-mattress",
            "code": "mattress-sales",
            "name": "Mattress Sales",
            "kind": "sales",
            "stages": [
                Stage(code="new", label="New Lead", sort=1),
                Stage(code="contacted", label="Contacted", sort=2),
                Stage(code="interested", label="Interested", sort=3),
                Stage(code="follow_up", label="Follow-up", sort=4),
                Stage(code="hot", label="Hot Lead", sort=5),
                Stage(code="order_initiated", label="Order Initiated", sort=6),
                Stage(code="converted", label="Converted", sort=7, is_won=True),
                Stage(code="not_interested", label="Not Interested", sort=8, is_lost=True),
            ]
        },
        {
            "id": "pipe-pillow",
            "code": "pillow-sales",
            "name": "Pillow Sales",
            "kind": "sales",
            "stages": [
                Stage(code="new", label="New Lead", sort=1),
                Stage(code="contacted", label="Contacted", sort=2),
                Stage(code="interested", label="Interested", sort=3),
                Stage(code="converted", label="Converted", sort=4, is_won=True),
                Stage(code="lost", label="Lost", sort=5, is_lost=True),
            ]
        },
        {
            "id": "pipe-topper",
            "code": "topper-sales",
            "name": "Topper Sales",
            "kind": "sales",
            "stages": [
                Stage(code="new", label="New Lead", sort=1),
                Stage(code="interested", label="Interested", sort=2),
                Stage(code="converted", label="Converted", sort=3, is_won=True),
            ]
        },
        {
            "id": "pipe-baby-kids",
            "code": "baby-kids-sales",
            "name": "Baby + Kids Sales",
            "kind": "sales",
            "stages": [
                Stage(code="new", label="New Lead", sort=1),
                Stage(code="consultation", label="Sleep Consultation", sort=2),
                Stage(code="converted", label="Converted", sort=3, is_won=True),
            ]
        },
        {
            "id": "pipe-abandoned-cart",
            "code": "abandoned-cart",
            "name": "Abandoned Cart Recovery",
            "kind": "intake",
            "stages": [
                Stage(code="cart_detected", label="Cart Detected", sort=1),
                Stage(code="outreach_sent", label="Outreach Sent", sort=2),
                Stage(code="discount_offered", label="Discount Offered", sort=3),
                Stage(code="recovered", label="Cart Recovered", sort=4, is_won=True),
                Stage(code="lost", label="Expired", sort=5, is_lost=True),
            ]
        },
    ]
    
    for p in pipeline_configs:
        pipe_dict = Pipeline(
            id=p["id"],
            code=p["code"],
            name=p["name"],
            kind=p["kind"],
            stages=p["stages"],
        ).model_dump()
        pipe_dict["is_test_data"] = True
        await db.pipelines.insert_one(pipe_dict)
        
    # 3. Campaigns (5 realistic campaigns)
    campaign_configs = [
        {"id": "camp-ortho-therapy", "code": "ortho-therapy-sept", "name": "September Ortho Therapy Campaign", "pipeline_id": "pipe-mattress", "source_kind": "website"},
        {"id": "camp-spine-balance", "code": "spine-balance-drive", "name": "Spine Balance Mattress Drive", "pipeline_id": "pipe-mattress", "source_kind": "popup"},
        {"id": "camp-dualis-pillow", "code": "dualis-pillow-leads", "name": "Dualis Ergonomic Pillow Blitz", "pipeline_id": "pipe-pillow", "source_kind": "cart_opportunity"},
        {"id": "camp-crib-kids", "code": "crib-comfort-kids", "name": "Organic Crib Mattress Consults", "pipeline_id": "pipe-baby-kids", "source_kind": "contact"},
        {"id": "camp-cart-rescue", "code": "cart-rescue-24h", "name": "Midnight Cart Recovery Blitz", "pipeline_id": "pipe-abandoned-cart", "source_kind": "cart_intent"},
    ]
    
    for c in campaign_configs:
        camp_dict = Campaign(
            id=c["id"],
            code=c["code"],
            name=c["name"],
            pipeline_id=c["pipeline_id"],
            source_kind=c["source_kind"],
        ).model_dump()
        camp_dict["is_test_data"] = True
        await db.campaigns.insert_one(camp_dict)

    # 4. Realistic Leads across sources (25 leads)
    sample_leads = [
        # Source 1: Website Signup
        {"name": "Aarav Kapoor", "email": "aarav.k@example.com", "phone": "9820011122", "source": "registration", "product": "Ortho Therapy Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "hot", "city": "Mumbai", "state": "Maharashtra"},
        {"name": "Deepika Sen", "email": "deepika.sen@example.com", "phone": "9820022233", "source": "registration", "product": "Spine Balance Mattress", "pipe": "pipe-mattress", "camp": "spine-balance-drive", "mgr": "mgr-rajesh-01", "emp": "emp-priya-02", "stage": "interested", "city": "Bengaluru", "state": "Karnataka"},
        {"name": "Rohan Mehra", "email": "rohan.mehra@example.com", "phone": "9820033344", "source": "registration", "product": "Standard Dualis Pillow", "pipe": "pipe-pillow", "camp": "dualis-pillow-leads", "mgr": "mgr-ananya-02", "emp": "emp-amit-03", "stage": "contacted", "city": "Delhi", "state": "Delhi"},
        {"name": "Siddharth Jain", "email": "sid.jain@example.com", "phone": "9820044455", "source": "registration", "product": "Ortho Core Max Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": None, "emp": None, "stage": "new", "city": "Pune", "state": "Maharashtra"},
        {"name": "Kavita Reddy", "email": "kavita.reddy@example.com", "phone": "9820055566", "source": "registration", "product": "Natural Latex Topper", "pipe": "pipe-topper", "camp": "ortho-therapy-sept", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "converted", "city": "Hyderabad", "state": "Telangana"},

        # Source 2: Add to Cart / Cart Opportunity
        {"name": "Tanvi Joshi", "email": "tanvi.j@example.com", "phone": "9830011122", "source": "cart_intent", "product": "Ortho Therapy Mattress (King)", "pipe": "pipe-abandoned-cart", "camp": "cart-rescue-24h", "mgr": "mgr-rajesh-01", "emp": "emp-priya-02", "stage": "discount_offered", "city": "Ahmedabad", "state": "Gujarat"},
        {"name": "Aditya Verma", "email": "aditya.v@example.com", "phone": "9830022233", "source": "cart_intent", "product": "Cooling Dualis Pillow", "pipe": "pipe-abandoned-cart", "camp": "cart-rescue-24h", "mgr": "mgr-ananya-02", "emp": "emp-amit-03", "stage": "recovered", "city": "Chandigarh", "state": "Punjab"},
        {"name": "Sneha Roy", "email": "sneha.roy@example.com", "phone": "9830033344", "source": "cart_intent", "product": "Spine Balance Mattress", "pipe": "pipe-abandoned-cart", "camp": "cart-rescue-24h", "mgr": None, "emp": None, "stage": "cart_detected", "city": "Kolkata", "state": "West Bengal"},
        {"name": "Gaurav Malhotra", "email": "gaurav.m@example.com", "phone": "9830044455", "source": "cart_intent", "product": "Luxury Memory Topper", "pipe": "pipe-abandoned-cart", "camp": "cart-rescue-24h", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "outreach_sent", "city": "Gurugram", "state": "Haryana"},
        {"name": "Neha Kulkarni", "email": "neha.k@example.com", "phone": "9830055566", "source": "cart_intent", "product": "Ortho Therapy Mattress", "pipe": "pipe-abandoned-cart", "camp": "cart-rescue-24h", "mgr": None, "emp": None, "stage": "cart_detected", "city": "Nagpur", "state": "Maharashtra"},

        # Source 3: Website Popup
        {"name": "Manoj Tiwari", "email": "manoj.t@example.com", "phone": "9840011122", "source": "manual", "product": "Spine Balance Mattress", "pipe": "pipe-mattress", "camp": "spine-balance-drive", "mgr": "mgr-ananya-02", "emp": "emp-amit-03", "stage": "follow_up", "city": "Lucknow", "state": "Uttar Pradesh"},
        {"name": "Pooja Hegde", "email": "pooja.h@example.com", "phone": "9840022233", "source": "manual", "product": "Contour Ergonomic Pillow", "pipe": "pipe-pillow", "camp": "dualis-pillow-leads", "mgr": "mgr-rajesh-01", "emp": "emp-priya-02", "stage": "interested", "city": "Mangalore", "state": "Karnataka"},
        {"name": "Varun Grover", "email": "varun.g@example.com", "phone": "9840033344", "source": "manual", "product": "Crib Organic Mattress", "pipe": "pipe-baby-kids", "camp": "crib-comfort-kids", "mgr": None, "emp": None, "stage": "new", "city": "Jaipur", "state": "Rajasthan"},
        {"name": "Ananya Pandey", "email": "ananya.p@example.com", "phone": "9840044455", "source": "manual", "product": "Ortho Therapy Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "order_initiated", "city": "Chennai", "state": "Tamil Nadu"},
        {"name": "Karan Singhania", "email": "karan.s@example.com", "phone": "9840055566", "source": "manual", "product": "Latex Hybrid Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": None, "emp": None, "stage": "new", "city": "Indore", "state": "Madhya Pradesh"},

        # Source 4: Contact Form & Consultation
        {"name": "Divya Nambiar", "email": "divya.n@example.com", "phone": "9850011122", "source": "contact", "product": "Baby Nursery Mattress", "pipe": "pipe-baby-kids", "camp": "crib-comfort-kids", "mgr": "mgr-ananya-02", "emp": "emp-amit-03", "stage": "consultation", "city": "Kochi", "state": "Kerala"},
        {"name": "Suresh Raina", "email": "suresh.r@example.com", "phone": "9850022233", "source": "contact", "product": "Ortho Therapy Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "converted", "city": "Ghaziabad", "state": "Uttar Pradesh"},
        {"name": "Meera Das", "email": "meera.d@example.com", "phone": "9850033344", "source": "contact", "product": "Standard Dualis Pillow", "pipe": "pipe-pillow", "camp": "dualis-pillow-leads", "mgr": "mgr-rajesh-01", "emp": "emp-priya-02", "stage": "not_interested", "city": "Bhubaneswar", "state": "Odisha"},
        {"name": "Harsh Vardhan", "email": "harsh.v@example.com", "phone": "9850044455", "source": "contact", "product": "Ortho Core Max Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": None, "emp": None, "stage": "new", "city": "Patna", "state": "Bihar"},
        {"name": "Bhavna Patel", "email": "bhavna.p@example.com", "phone": "9850055566", "source": "contact", "product": "Natural Latex Topper", "pipe": "pipe-topper", "camp": "ortho-therapy-sept", "mgr": "mgr-ananya-02", "emp": "emp-amit-03", "stage": "converted", "city": "Surat", "state": "Gujarat"},

        # Source 5: Dealer & Walk-in
        {"name": "Rajiv Khanna", "email": "rajiv.k@example.com", "phone": "9860011122", "source": "dealer_inquiry", "product": "Bulk Spine Balance Deal", "pipe": "pipe-mattress", "camp": "spine-balance-drive", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "hot", "city": "Delhi", "state": "Delhi"},
        {"name": "Sunita Agarwal", "email": "sunita.a@example.com", "phone": "9860022233", "source": "manual", "product": "Ortho Therapy Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": "mgr-rajesh-01", "emp": "emp-priya-02", "stage": "contacted", "city": "Jaipur", "state": "Rajasthan"},
        {"name": "Tarun Mittal", "email": "tarun.m@example.com", "phone": "9860033344", "source": "manual", "product": "Cooling Dualis Pillow", "pipe": "pipe-pillow", "camp": "dualis-pillow-leads", "mgr": None, "emp": None, "stage": "new", "city": "Ludhiana", "state": "Punjab"},
        {"name": "Alok Nath", "email": "alok.n@example.com", "phone": "9860044455", "source": "manual", "product": "Spine Balance Mattress", "pipe": "pipe-mattress", "camp": "spine-balance-drive", "mgr": "mgr-ananya-02", "emp": "emp-amit-03", "stage": "order_initiated", "city": "Varanasi", "state": "Uttar Pradesh"},
        {"name": "Rekha Sharma", "email": "rekha.s@example.com", "phone": "9860055566", "source": "manual", "product": "Ortho Therapy Mattress", "pipe": "pipe-mattress", "camp": "ortho-therapy-sept", "mgr": "mgr-rajesh-01", "emp": "emp-vikram-01", "stage": "converted", "city": "Bengaluru", "state": "Karnataka"},
    ]
    
    created_leads = []
    idx = 100
    for sl in sample_leads:
        idx += 1
        lead_id = f"lead-test-{idx}"
        lead_doc = {
            "id": lead_id,
            "lead_number": f"KL-{idx}",
            "kind": "sales",
            "name": sl["name"],
            "email": sl["email"],
            "phone": sl["phone"],
            "pipeline_id": sl["pipe"],
            "campaign_code": sl["camp"],
            "product_interest": sl["product"],
            "stage_code": sl["stage"],
            "qualification": "converted" if sl["stage"] in ("converted", "recovered") else "sales_qualified",
            "source_kind": sl["source"],
            "manager_id": sl["mgr"],
            "employee_id": sl["emp"],
            "is_open": sl["stage"] not in ("converted", "recovered", "not_interested", "lost"),
            "city": sl["city"],
            "state": sl["state"],
            "is_test_data": True,
            "created_at": now - timedelta(days=idx % 14, hours=idx % 8),
            "updated_at": now - timedelta(hours=idx % 5),
            "stage_history": [
                {"at": now - timedelta(days=3), "from": "new", "to": sl["stage"], "actor": "system.test", "reason": "Test setup"}
            ],
            "assignment_history": [
                {"at": now - timedelta(days=2), "actor": "admin@kotson.test", "manager_id": sl["mgr"], "employee_id": sl["emp"], "reason": "Campaign assignment"}
            ] if sl["emp"] else []
        }
        await db.leads.insert_one(lead_doc)
        created_leads.append(lead_doc)

    # 5. Calls (5 connected, 5 not connected)
    call_records = [
        # 5 Connected
        {"lead": created_leads[0], "conn": "connected", "disp": "interested", "out": "hot", "summary": "Customer discussed 8 inch Queen size mattress; requested price quote."},
        {"lead": created_leads[1], "conn": "connected", "disp": "interested", "out": "interested", "summary": "Wants to know Spine Balance foam firmness rating."},
        {"lead": created_leads[4], "conn": "connected", "disp": "order_discussion", "out": "converted", "summary": "Confirmed delivery address and paid online via UPI."},
        {"lead": created_leads[16], "conn": "connected", "disp": "order_discussion", "out": "converted", "summary": "Ordered King size Ortho Therapy mattress."},
        {"lead": created_leads[10], "conn": "connected", "disp": "follow_up_required", "out": "follow_up", "summary": "Call back after 5 PM regarding fabric samples."},
        # 5 Not Connected
        {"lead": created_leads[2], "conn": "not_connected", "disp": "busy", "out": None, "summary": "Phone busy. Will try again."},
        {"lead": created_leads[5], "conn": "not_connected", "disp": "no_answer", "out": None, "summary": "Ringing, no response."},
        {"lead": created_leads[8], "conn": "not_connected", "disp": "switched_off", "out": None, "summary": "Phone switched off."},
        {"lead": created_leads[17], "conn": "not_connected", "disp": "call_later", "out": None, "summary": "Customer asked to call back tomorrow."},
        {"lead": created_leads[21], "conn": "not_connected", "disp": "network_issue", "out": None, "summary": "Call dropped due to network issues."},
    ]
    
    for c in call_records:
        cid = f"call-test-{uuid.uuid4().hex[:8]}"
        lead = c["lead"]
        agent = lead["employee_id"] or "emp-vikram-01"
        call_doc = {
            "id": cid,
            "lead_id": lead["id"],
            "connectivity_code": c["conn"],
            "connectivity_label": "Connected" if c["conn"] == "connected" else "Not Connected",
            "disposition_code": c["disp"],
            "disposition_label": c["disp"].replace("_", " ").title(),
            "outcome_code": c["out"],
            "outcome_label": c["out"].replace("_", " ").title() if c["out"] else None,
            "summary": c["summary"],
            "agent_id": agent,
            "agent_email": f"{agent}@kotson.test",
            "is_test_data": True,
            "created_at": now - timedelta(hours=12),
        }
        await db.calls.insert_one(call_doc)

    # 6. Follow-ups (due today, overdue, upcoming)
    sample_fus = [
        # Due Today
        {"lead": created_leads[0], "due": now + timedelta(hours=2), "reason": "Follow-up on Ortho Therapy 8-inch quote", "status": "pending"},
        {"lead": created_leads[1], "due": now + timedelta(hours=4), "reason": "Confirm firmness preference with spouse", "status": "pending"},
        # Overdue
        {"lead": created_leads[10], "due": now - timedelta(days=1), "reason": "Overdue callback on fabric color selection", "status": "pending"},
        {"lead": created_leads[15], "due": now - timedelta(hours=18), "reason": "Crib dimension measurement check", "status": "pending"},
        # Upcoming
        {"lead": created_leads[2], "due": now + timedelta(days=2), "reason": "Pillow bundle weekend offer inquiry", "status": "pending"},
        {"lead": created_leads[21], "due": now + timedelta(days=3), "reason": "Follow-up after store showroom visit", "status": "pending"},
    ]
    
    for f in sample_fus:
        fid = f"fu-test-{uuid.uuid4().hex[:8]}"
        lead = f["lead"]
        owner = lead["employee_id"] or "emp-vikram-01"
        fu_doc = {
            "id": fid,
            "lead_id": lead["id"],
            "due_at": f["due"],
            "reason": f["reason"],
            "status": f["status"],
            "owner_id": owner,
            "created_by": f"{owner}@kotson.test",
            "is_test_data": True,
            "created_at": now - timedelta(days=1),
        }
        await db.follow_ups.insert_one(fu_doc)

    # 7. Workforce Attendance Sessions
    # Vikram: Present & Clocked in today
    att_vikram = AttendanceSession(
        id="att-vikram-today",
        employee_id="emp-vikram-01",
        employee_name="Vikram Sethi",
        employee_email="vikram.sethi@kotson.test",
        manager_id="mgr-rajesh-01",
        date=today_str,
        clock_in_at=now - timedelta(hours=4),
        breaks=[
            BreakRecord(
                start_at=now - timedelta(hours=2),
                end_at=now - timedelta(hours=1, minutes=30),
                duration_minutes=30.0,
                reason="Lunch Break"
            )
        ],
        status="present",
        gross_minutes=240.0,
        break_minutes=30.0,
        net_minutes=210.0,
    ).model_dump()
    att_vikram["is_test_data"] = True
    await db.attendance_sessions.insert_one(att_vikram)
    
    # Priya: Clocked in and currently ON BREAK
    att_priya = AttendanceSession(
        id="att-priya-today",
        employee_id="emp-priya-02",
        employee_name="Priya Nair",
        employee_email="priya.nair@kotson.test",
        manager_id="mgr-rajesh-01",
        date=today_str,
        clock_in_at=now - timedelta(hours=3),
        breaks=[
            BreakRecord(
                start_at=now - timedelta(minutes=20),
                end_at=None,
                reason="Tea Break"
            )
        ],
        status="present",
    ).model_dump()
    att_priya["is_test_data"] = True
    await db.attendance_sessions.insert_one(att_priya)

    # Amit: Late arrival
    att_amit = AttendanceSession(
        id="att-amit-today",
        employee_id="emp-amit-03",
        employee_name="Amit Deshmukh",
        employee_email="amit.deshmukh@kotson.test",
        manager_id="mgr-ananya-02",
        date=today_str,
        clock_in_at=now - timedelta(hours=2),
        status="late",
        is_late=True,
    ).model_dump()
    att_amit["is_test_data"] = True
    await db.attendance_sessions.insert_one(att_amit)

    # Past attendance sessions for monthly calendar
    for i in range(1, 10):
        day_date = (datetime.now(timezone.utc).astimezone(IST) - timedelta(days=i)).strftime("%Y-%m-%d")
        sess = AttendanceSession(
            id=f"att-hist-vikram-{i}",
            employee_id="emp-vikram-01",
            employee_name="Vikram Sethi",
            employee_email="vikram.sethi@kotson.test",
            manager_id="mgr-rajesh-01",
            date=day_date,
            clock_in_at=now - timedelta(days=i, hours=8),
            clock_out_at=now - timedelta(days=i),
            gross_minutes=480.0,
            break_minutes=45.0,
            net_minutes=435.0,
            status="present" if i != 3 else "late",
            is_late=(i == 3),
        ).model_dump()
        sess["is_test_data"] = True
        await db.attendance_sessions.insert_one(sess)

    # 8. Leave Requests (5 records)
    sample_leaves = [
        {"emp": "emp-vikram-01", "name": "Vikram Sethi", "type": "casual", "label": "Casual Leave (CL)", "from": "2026-09-28", "to": "2026-09-28", "days": 1.0, "reason": "Family wedding function", "status": "approved", "rev": "Rajesh Sharma"},
        {"emp": "emp-priya-02", "name": "Priya Nair", "type": "sick", "label": "Sick Leave (SL)", "from": "2026-09-25", "to": "2026-09-26", "days": 2.0, "reason": "Viral fever recovery", "status": "pending", "rev": None},
        {"emp": "emp-amit-03", "name": "Amit Deshmukh", "type": "paid", "label": "Privilege / Paid Leave (PL)", "from": "2026-10-05", "to": "2026-10-09", "days": 5.0, "reason": "Annual festival vacation", "status": "approved", "rev": "Ananya Iyer"},
        {"emp": "emp-vikram-01", "name": "Vikram Sethi", "type": "unpaid", "label": "Loss of Pay (LOP)", "from": "2026-09-02", "to": "2026-09-02", "days": 1.0, "reason": "Personal urgent task", "status": "rejected", "rev": "Rajesh Sharma"},
        {"emp": "emp-priya-02", "name": "Priya Nair", "type": "comp_off", "label": "Compensatory Off", "from": "2026-09-29", "to": "2026-09-29", "days": 1.0, "reason": "Worked Sunday mattress expo", "status": "pending", "rev": None},
    ]
    
    for l in sample_leaves:
        lid = f"leave-test-{uuid.uuid4().hex[:8]}"
        leave_doc = LeaveRequest(
            id=lid,
            employee_id=l["emp"],
            employee_name=l["name"],
            employee_email=f"{l['emp']}@kotson.test",
            manager_id="mgr-rajesh-01" if l["emp"] != "emp-amit-03" else "mgr-ananya-02",
            leave_type_code=l["type"],
            leave_type_label=l["label"],
            from_date=l["from"],
            to_date=l["to"],
            days_count=l["days"],
            reason=l["reason"],
            status=l["status"],
            reviewed_by=l["rev"],
            reviewed_at=now - timedelta(days=2) if l["rev"] else None,
        ).model_dump()
        leave_doc["is_test_data"] = True
        await db.leave_requests.insert_one(leave_doc)

    # 9. Payroll Period & Records (September 2026)
    pid = "period-test-2026-09"
    period_doc = PayrollPeriod(
        id=pid,
        month="2026-09",
        name="September 2026",
        status="reviewed",
        working_days=26,
        total_gross_paise=10500000,
        total_deductions_paise=269230,
        total_net_paise=10230770,
    ).model_dump()
    period_doc["is_test_data"] = True
    await db.payroll_periods.insert_one(period_doc)
    
    payroll_sample = [
        {"emp": "emp-vikram-01", "name": "Vikram Sethi", "gross": 3500000, "present": 25.0, "lop": 134615, "net": 3365385},
        {"emp": "emp-priya-02", "name": "Priya Nair", "gross": 3500000, "present": 26.0, "lop": 0, "net": 3500000},
        {"emp": "emp-amit-03", "name": "Amit Deshmukh", "gross": 3500000, "present": 25.0, "lop": 134615, "net": 3365385},
    ]
    for ps in payroll_sample:
        pr_id = f"payrec-test-{uuid.uuid4().hex[:8]}"
        prec_doc = PayrollRecord(
            id=pr_id,
            period_id=pid,
            month="2026-09",
            employee_id=ps["emp"],
            employee_name=ps["name"],
            employee_role="EMPLOYEE",
            manager_id="mgr-rajesh-01" if ps["emp"] != "emp-amit-03" else "mgr-ananya-02",
            working_days=26,
            present_days=ps["present"],
            gross_salary_paise=ps["gross"],
            lop_deduction_paise=ps["lop"],
            net_payable_paise=ps["net"],
            status="reviewed",
        ).model_dump()
        prec_doc["is_test_data"] = True
        await db.payroll_records.insert_one(prec_doc)

    # 10. Converted Orders safely attributed to CRM
    order_samples = [
        {"lead": created_leads[4], "total": 8450000, "product": "Natural Latex Topper (King)"},
        {"lead": created_leads[6], "total": 1250000, "product": "Cooling Dualis Pillow Pair"},
        {"lead": created_leads[16], "total": 7400000, "product": "Ortho Therapy Mattress (Queen 75x60x8)"},
        {"lead": created_leads[19], "total": 5200000, "product": "Natural Latex Topper (Queen)"},
        {"lead": created_leads[24], "total": 7400000, "product": "Ortho Therapy Mattress (Queen)"},
    ]
    
    for i, osmp in enumerate(order_samples):
        oid = f"order-test-{uuid.uuid4().hex[:8]}"
        ord_doc = {
            "id": oid,
            "order_number": f"KTS-TEST-{1000 + i}",
            "user_id": f"cust-test-{i}",
            "payment_status": "paid",
            "fulfilment_status": "processing",
            "sales_source": "CRM",
            "crm_employee_id": osmp["lead"]["employee_id"] or "emp-vikram-01",
            "crm_manager_id": osmp["lead"]["manager_id"] or "mgr-rajesh-01",
            "crm_pipeline_id": osmp["lead"]["pipeline_id"],
            "crm_campaign_id": osmp["lead"]["campaign_code"],
            "crm_lead_id": osmp["lead"]["id"],
            "amounts": {"subtotal": osmp["total"], "discount": 0, "shipping": 0, "total": osmp["total"]},
            "items": [{"product_name": osmp["product"], "qty": 1, "unit_price": osmp["total"]}],
            "address": {"full_name": osmp["lead"]["name"], "phone": osmp["lead"]["phone"], "city": osmp["lead"]["city"], "state": osmp["lead"]["state"]},
            "payment": {"method": "upi", "gateway": "razorpay_mock", "status": "captured"},
            "is_test_data": True,
            "created_at": now - timedelta(days=i + 1),
        }
        await db.orders.insert_one(ord_doc)
        
        # Link order back to lead
        await db.leads.update_one(
            {"id": osmp["lead"]["id"]},
            {"$set": {"converted_order_id": oid, "converted_at": now - timedelta(days=i + 1), "stage_code": "converted"}}
        )

    return {
        "message": "Realistic Kotson CRM test data seeded successfully",
        "staff_seeded": len(managers_data) + len(employees_data),
        "pipelines_seeded": len(pipeline_configs),
        "campaigns_seeded": len(campaign_configs),
        "leads_seeded": len(sample_leads),
        "calls_seeded": len(call_records),
        "follow_ups_seeded": len(sample_fus),
        "attendance_sessions_seeded": 12,
        "leave_requests_seeded": len(sample_leaves),
        "payroll_records_seeded": len(payroll_sample),
        "crm_orders_seeded": len(order_samples),
    }
