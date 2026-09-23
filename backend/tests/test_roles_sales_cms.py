"""Unit and integration tests for role system, sales API, CMS, and lead intake."""

import pytest
from lib.security import (
    OWNER,
    OWNER_ADMIN,
    ADMIN,
    CRM_MASTER,
    CRM_MASTER_ADMIN,
    CUSTOMER,
    has_role,
    can,
)


def test_role_aliases_and_checks():
    assert OWNER_ADMIN == OWNER
    assert CRM_MASTER_ADMIN == CRM_MASTER

    owner_user = {"roles": ["owner"]}
    admin_user = {"roles": ["admin"]}
    crm_master_user = {"roles": ["crm_master"]}
    customer_user = {"roles": ["customer"]}

    # has_role aliases
    assert has_role(owner_user, OWNER)
    assert has_role(owner_user, "owner_admin")
    assert has_role(admin_user, OWNER)  # admin aliases owner
    assert has_role(crm_master_user, "crm_master_admin")

    # can() capability helper
    assert can(owner_user, "view_sales")
    assert can(owner_user, "view_crm")
    assert can(crm_master_user, "view_sales")
    assert can(crm_master_user, "view_crm")
    assert not can(crm_master_user, "manage_orders")
    assert not can(customer_user, "view_sales")


def test_public_status(client):
    res = client.get("/status")
    assert res.status_code == 200


def test_capture_lead_public(client):
    res = client.post(
        "/crm/capture-lead",
        json={
            "name": "Priya Sharma",
            "phone": "+919876543210",
            "email": "priya.lead@test.com",
            "source_page": "/products/kotson-organic-latex-mattress",
            "form_source": "product_inquiry",
            "product_interest": "Organic Latex King Size",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "success"


def test_sales_summary_requires_staff(client):
    # Unauthenticated should return 401
    res = client.get("/admin/sales/summary")
    assert res.status_code in (401, 403)


def test_public_cms_pages(client):
    res = client.get("/cms/pages")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
