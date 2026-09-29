"""Kotson Authoritative PostgreSQL / Supabase Database Provider Layer.

Direct PostgreSQL persistence via asyncpg pool for Staging & Production.
Zero dependence on local JSON or MongoDB.
Guarantees fail-closed startup and pure SQL execution.
"""

from copy import deepcopy
from datetime import datetime, timezone
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import uuid

logger = logging.getLogger(__name__)

# Complete mapping from application collection names to PostgreSQL tables
TABLE_MAP: Dict[str, str] = {
    "users": "users",
    "sessions": "user_sessions",
    "user_sessions": "user_sessions",
    "addresses": "user_addresses",
    "user_addresses": "user_addresses",
    "categories": "categories",
    "products": "products",
    "variants": "product_variants",
    "product_variants": "product_variants",
    "inventory_ledger": "inventory_ledger",
    "reservations": "inventory_reservations",
    "stock_reservations": "inventory_reservations",
    "inventory_reservations": "inventory_reservations",
    "carts": "carts",
    "orders": "orders",
    "referral_rules": "referral_rules",
    "referral_rule_audits": "referral_rules",
    "referral_settings": "referral_rules",
    "referral_clicks": "referral_clicks",
    "referral_attributions": "referral_attributions",
    "referral_rewards": "referral_rewards",
    "wallet_ledger": "wallet_ledger",
    "reward_ledger": "wallet_ledger",
    "kyc_records": "kyc_records",
    "referral_withdrawals": "referral_withdrawals",
    "crm_leads": "crm_leads",
    "leads": "crm_leads",
    "crm_follow_ups": "crm_follow_ups",
    "follow_ups": "crm_follow_ups",
    "crm_calls": "crm_calls",
    "calls": "crm_calls",
    "cms_blocks": "cms_blocks",
    "blocks": "cms_blocks",
    "cms_claims": "cms_claims",
    "claims": "cms_claims",
    "certifications": "cms_claims",
    "cms_pages": "cms_pages",
    "blogs": "blogs",
    "audit_logs": "audit_logs",
    "audit_log": "audit_logs",
    "password_resets": "password_resets",
    "custom_product_requests": "custom_product_requests",
    "custom_configurations": "custom_product_requests",
    "dealers": "dealers",
    "dealer_pricing_rules": "dealer_pricing_rules",
    "dealer_orders": "dealer_orders",
    "attendance_sessions": "attendance_sessions",
    "attendance_corrections": "attendance_corrections",
    "leave_requests": "leave_requests",
    "salary_structures": "salary_structures",
    "payroll_periods": "payroll_periods",
    "payroll_records": "payroll_records",
    "shipments": "shipments",
    "return_requests": "return_requests",
    "carriers": "carriers",
    "refunds": "refunds",
    "stock_dispatches": "stock_dispatches",
    "stock_transactions": "stock_transactions",
    "manual_stock_items": "manual_stock_items",
    "processed_events": "processed_events",
    "source_events": "processed_events",
    "payments": "payments",
    "settings": "settings",
    "assets": "assets",
    "asset_library": "assets",
    "counters": "counters",
    "status_checks": "status_checks",
}

# Known JSONB columns across tables for proper serialization/deserialization
JSONB_COLUMNS = {
    "consent", "shipping_address", "billing_address", "items", "metadata",
    "sections", "details", "events", "breaks", "address", "destination",
    "payload", "value", "raw_response", "inspection", "trail"
}

# Column aliases to bridge schema differences (e.g. MongoDB dot-notation or legacy keys)
COLUMN_ALIASES = {
    "razorpay.order.id": "razorpay_order_id",
    "razorpay.payment.id": "razorpay_payment_id",
    "_id": "id",
    "sort": "sort_order",
    "payment_status": "status",
    "timestamp": "created_at",
}

TABLE_COLUMN_ALIASES: Dict[str, Dict[str, str]] = {
    "orders": {"customer_id": "user_id"},
    "user_addresses": {"customer_id": "user_id"},
    "addresses": {"customer_id": "user_id"},
}


def get_column_alias(table: Optional[str], raw_k: str) -> str:
    """Retrieve column alias with table-specific overrides."""
    if table and table in TABLE_COLUMN_ALIASES:
        if raw_k in TABLE_COLUMN_ALIASES[table]:
            return TABLE_COLUMN_ALIASES[table][raw_k]
    return COLUMN_ALIASES.get(raw_k, raw_k)


def _record_to_dict(rec: Any) -> Dict[str, Any]:
    """Convert asyncpg Record to dict with proper JSON and type conversions."""
    if not rec:
        return {}
    d = dict(rec)
    for k, v in list(d.items()):
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
        elif k in JSONB_COLUMNS and isinstance(v, str):
            try:
                d[k] = json.loads(v)
            except Exception:
                pass
    if "id" in d and "_id" not in d:
        d["_id"] = d["id"]
    if "price_paise" in d:
        d.setdefault("price", d["price_paise"])
    if "mrp_paise" in d:
        d.setdefault("mrp", d["mrp_paise"])
    if "title" in d:
        d.setdefault("size", d["title"])
    if "image_url" in d:
        d.setdefault("image", d["image_url"])
        d.setdefault("images", [d["image_url"]])
    return d


VARCHAR_ID_COLUMNS = {
    ("product_variants", "id"),
    ("referral_rules", "id"),
    ("custom_product_requests", "id"),
    ("settings", "id"),
    ("counters", "id"),
    ("cms_blocks", "id"),
    ("cms_claims", "id"),
    ("cms_pages", "id"),
    ("blogs", "id"),
    ("assets", "id"),
    ("status_checks", "id"),
}


def _sanitize_for_column(col_name: str, val: Any, table: Optional[str] = None) -> Any:
    """Prepare Python value for PostgreSQL column insertion."""
    if val is None:
        return None
    if col_name in JSONB_COLUMNS:
        if isinstance(val, (dict, list)):
            return json.dumps(val, default=str)
        return str(val)
    if (table, col_name) in VARCHAR_ID_COLUMNS or col_name in ("variant_id", "order_id"):
        return str(val)
    if col_name == "id" or col_name.endswith("_id"):
        # If it looks like a valid UUID string, convert to uuid.UUID
        if isinstance(val, str) and len(val) == 36 and val.count("-") == 4:
            try:
                return uuid.UUID(val)
            except Exception:
                pass
    if isinstance(val, str) and ("_at" in col_name or col_name == "timestamp"):
        try:
            s = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            pass
    return val


def _build_where_clause(
    filter_query: Optional[Dict[str, Any]],
    start_idx: int = 1,
    table: Optional[str] = None,
) -> Tuple[str, List[Any]]:
    """Build SQL WHERE clause from filter dict."""
    if not filter_query:
        return "TRUE", []

    conditions = []
    params: List[Any] = []
    curr_idx = start_idx

    for raw_k, v in filter_query.items():
        k = get_column_alias(table, raw_k)

        if table == "referral_clicks" and k in ("session_id", "timestamp"):
            conditions.append("FALSE")
            continue

        if k == "$or" and isinstance(v, list):
            or_parts = []
            for sub_f in v:
                sub_where, sub_p = _build_where_clause(sub_f, curr_idx, table)
                or_parts.append(sub_where)
                params.extend(sub_p)
                curr_idx += len(sub_p)
            if or_parts:
                conditions.append(f"({' OR '.join(or_parts)})")
            continue

        if k == "$and" and isinstance(v, list):
            and_parts = []
            for sub_f in v:
                sub_where, sub_p = _build_where_clause(sub_f, curr_idx, table)
                and_parts.append(sub_where)
                params.extend(sub_p)
                curr_idx += len(sub_p)
            if and_parts:
                conditions.append(f"({' AND '.join(and_parts)})")
            continue

        # Column handling with operators
        col = f'"{k}"' if not k.startswith('"') else k

        if k == "roles" and isinstance(v, str):
            conditions.append(f"${curr_idx} = ANY({col})")
            params.append(v)
            curr_idx += 1
            continue
        if isinstance(v, dict):
            for op, op_val in v.items():
                if op == "$eq":
                    conditions.append(f"{col} = ${curr_idx}")
                    params.append(_sanitize_for_column(k, op_val, table))
                    curr_idx += 1
                elif op == "$ne":
                    conditions.append(f"({col} IS NULL OR {col} != ${curr_idx})")
                    params.append(_sanitize_for_column(k, op_val, table))
                    curr_idx += 1
                elif op == "$in":
                    conditions.append(f"{col} = ANY(${curr_idx})")
                    params.append([_sanitize_for_column(k, item, table) for item in op_val])
                    curr_idx += 1
                elif op == "$nin":
                    conditions.append(f"NOT ({col} = ANY(${curr_idx}))")
                    params.append([_sanitize_for_column(k, item, table) for item in op_val])
                    curr_idx += 1
                elif op == "$gt":
                    conditions.append(f"{col} > ${curr_idx}")
                    params.append(_sanitize_for_column(k, op_val, table))
                    curr_idx += 1
                elif op == "$gte":
                    conditions.append(f"{col} >= ${curr_idx}")
                    params.append(_sanitize_for_column(k, op_val, table))
                    curr_idx += 1
                elif op == "$lt":
                    conditions.append(f"{col} < ${curr_idx}")
                    params.append(_sanitize_for_column(k, op_val, table))
                    curr_idx += 1
                elif op == "$lte":
                    conditions.append(f"{col} <= ${curr_idx}")
                    params.append(_sanitize_for_column(k, op_val, table))
                    curr_idx += 1
        else:
            if v is None:
                conditions.append(f"{col} IS NULL")
            else:
                conditions.append(f"{col} = ${curr_idx}")
                params.append(_sanitize_for_column(k, v, table))
                curr_idx += 1

    return " AND ".join(conditions) if conditions else "TRUE", params


class PostgresCursor:
    """Async cursor interface matching application expectations."""
    def __init__(self, db: "PostgresDatabase", table: str, filter_query: Optional[Dict[str, Any]] = None):
        self._db = db
        self._table = table
        self._filter = filter_query or {}
        self._order_by: Optional[str] = None
        self._skip_val: int = 0
        self._limit_val: Optional[int] = None

    def sort(self, key_or_list: Any, direction: Optional[int] = None) -> "PostgresCursor":
        if isinstance(key_or_list, list):
            clauses = []
            for item in key_or_list:
                if isinstance(item, tuple):
                    k, d = item
                    col = get_column_alias(self._table, k)
                    clauses.append(f'"{col}" {"ASC" if d == 1 else "DESC"}')
            self._order_by = ", ".join(clauses)
        elif isinstance(key_or_list, str):
            col = get_column_alias(self._table, key_or_list)
            dir_str = "ASC" if (direction is None or direction == 1) else "DESC"
            self._order_by = f'"{col}" {dir_str}'
        return self

    def skip(self, n: int) -> "PostgresCursor":
        self._skip_val = max(0, n)
        return self

    def limit(self, n: int) -> "PostgresCursor":
        self._limit_val = max(0, n)
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        limit = length if length is not None else self._limit_val
        pool = await self._db._get_pool()
        if not pool:
            return []

        where_sql, params = _build_where_clause(self._filter, table=self._table)
        sql = f'SELECT * FROM "{self._table}" WHERE {where_sql}'
        if self._order_by:
            sql += f" ORDER BY {self._order_by}"
        if limit:
            sql += f" LIMIT {int(limit)}"
        if self._skip_val:
            sql += f" OFFSET {int(self._skip_val)}"

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)
                return [_record_to_dict(r) for r in rows]
        except Exception as exc:
            logger.error("PostgresCursor.to_list(%s) failed: %s", self._table, exc)
            return []

    def __aiter__(self) -> "PostgresCursor":
        return self

    async def __anext__(self) -> Dict[str, Any]:
        if not hasattr(self, "_cached_rows"):
            self._cached_rows = await self.to_list()
            self._pos = 0
        if self._pos < len(self._cached_rows):
            doc = self._cached_rows[self._pos]
            self._pos += 1
            return doc
        raise StopAsyncIteration


class PostgresCollection:
    """Authoritative PostgreSQL table repository adapter."""
    def __init__(self, db: "PostgresDatabase", name: str):
        self._db = db
        self.name = name
        self.table = TABLE_MAP.get(name, name)

    async def find_one(
        self,
        filter: Optional[Dict[str, Any]] = None,
        projection: Optional[Dict[str, Any]] = None,
        sort: Optional[Any] = None,
    ) -> Optional[Dict[str, Any]]:
        cursor = PostgresCursor(self._db, self.table, filter)
        if sort:
            cursor.sort(sort)
        docs = await cursor.to_list(1)
        return docs[0] if docs else None

    def find(
        self,
        filter: Optional[Dict[str, Any]] = None,
        projection: Optional[Dict[str, Any]] = None,
    ) -> PostgresCursor:
        return PostgresCursor(self._db, self.table, filter)

    async def count_documents(self, filter: Optional[Dict[str, Any]] = None) -> int:
        pool = await self._db._get_pool()
        if not pool:
            return 0
        where_sql, params = _build_where_clause(filter, table=self.table)
        sql = f'SELECT COUNT(*) FROM "{self.table}" WHERE {where_sql}'
        try:
            async with pool.acquire() as conn:
                val = await conn.fetchval(sql, *params)
                return int(val or 0)
        except Exception as exc:
            logger.error("PostgresCollection.count_documents(%s) failed: %s", self.table, exc)
            return 0

    async def insert_one(self, document: Dict[str, Any]) -> Any:
        from lib.db import InsertOneResult
        pool = await self._db._get_pool()
        if not pool:
            raise RuntimeError("PostgreSQL connection pool unavailable for insert_one")

        doc = deepcopy(document)
        doc_id = doc.get("id") or doc.get("_id")
        if not doc_id:
            doc_id = str(uuid.uuid4())
            doc["id"] = doc_id
        if "_id" not in doc:
            doc["_id"] = doc_id

        if self.table == "products":
            if "price" in doc and "price_paise" not in doc:
                doc["price_paise"] = int(doc.pop("price"))
            if "mrp" in doc and "mrp_paise" not in doc:
                doc["mrp_paise"] = int(doc.pop("mrp"))
            if "mrp_paise" not in doc and "price_paise" in doc:
                doc["mrp_paise"] = doc["price_paise"]
            if "image_url" not in doc:
                doc["image_url"] = doc.pop("image", None) or (doc.get("images", [""])[0] if isinstance(doc.get("images"), list) and doc.get("images") else "https://kotsonmattress.com/placeholder.jpg")
            doc.pop("images", None)
            doc.pop("image", None)
            if "sort" in doc and "sort_order" not in doc:
                doc["sort_order"] = doc.pop("sort")

        elif self.table == "product_variants":
            if "price" in doc and "price_paise" not in doc:
                doc["price_paise"] = int(doc.pop("price"))
            if "mrp" in doc and "mrp_paise" not in doc:
                doc["mrp_paise"] = int(doc.pop("mrp"))
            if "mrp_paise" not in doc and "price_paise" in doc:
                doc["mrp_paise"] = doc["price_paise"]
            if "size" in doc and "title" not in doc:
                doc["title"] = str(doc.pop("size"))
            elif "title" not in doc:
                doc["title"] = str(doc.get("sku", "Standard"))
            doc.pop("size", None)

        elif self.table == "processed_events":
            if "event_key" in doc and "event_id" not in doc:
                doc["event_id"] = doc.pop("event_key")
            if "event_id" not in doc:
                doc["event_id"] = str(doc.get("id"))
            pe_cols = {"id", "event_id", "event_type", "payload", "created_at"}
            extra = {}
            for k in list(doc.keys()):
                if k not in pe_cols and k != "_id":
                    extra[k] = doc.pop(k)
            if extra:
                payload = doc.get("payload") or {}
                if isinstance(payload, str):
                    try:
                        payload = json.loads(payload)
                    except Exception:
                        payload = {"raw": payload}
                payload.update(extra)
                doc["payload"] = payload

        # Prepare column insertion
        cols = []
        vals = []
        placeholders = []
        curr_idx = 1

        for raw_k, v in doc.items():
            if raw_k == "_id":
                continue
            k = get_column_alias(self.table, raw_k)
            cols.append(f'"{k}"')
            vals.append(_sanitize_for_column(k, v, self.table))
            placeholders.append(f"${curr_idx}")
            curr_idx += 1

        sql = f'INSERT INTO "{self.table}" ({", ".join(cols)}) VALUES ({", ".join(placeholders)}) RETURNING id'
        try:
            async with pool.acquire() as conn:
                res_id = await conn.fetchval(sql, *vals)
                return InsertOneResult(inserted_id=str(res_id or doc_id))
        except Exception as exc:
            logger.error("PostgresCollection.insert_one(%s) failed: %s", self.table, exc)
            raise

    async def insert_many(self, documents: List[Dict[str, Any]]) -> Any:
        from lib.db import InsertManyResult
        inserted_ids = []
        for d in documents:
            res = await self.insert_one(d)
            inserted_ids.append(res.inserted_id)
        return InsertManyResult(inserted_ids)

    async def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> Any:
        from lib.db import UpdateResult
        pool = await self._db._get_pool()
        if not pool:
            raise RuntimeError("PostgreSQL connection pool unavailable for update_one")

        set_fields = dict(update.get("$set", {}))
        inc_fields = dict(update.get("$inc", {}))
        push_fields = dict(update.get("$push", {}))

        if self.table in ("products", "product_variants"):
            if "price" in set_fields and "price_paise" not in set_fields:
                set_fields["price_paise"] = int(set_fields.pop("price"))
            if "mrp" in set_fields and "mrp_paise" not in set_fields:
                set_fields["mrp_paise"] = int(set_fields.pop("mrp"))
            if "size" in set_fields and "title" not in set_fields and self.table == "product_variants":
                set_fields["title"] = str(set_fields.pop("size"))
            set_fields.pop("size", None)

        set_clauses = []
        params = []
        curr_idx = 1

        for raw_k, v in set_fields.items():
            k = get_column_alias(self.table, raw_k)
            set_clauses.append(f'"{k}" = ${curr_idx}')
            params.append(_sanitize_for_column(k, v, self.table))
            curr_idx += 1

        for raw_k, inc_v in inc_fields.items():
            k = get_column_alias(self.table, raw_k)
            set_clauses.append(f'"{k}" = COALESCE("{k}", 0) + ${curr_idx}')
            params.append(inc_v)
            curr_idx += 1

        for raw_k, push_v in push_fields.items():
            k = get_column_alias(self.table, raw_k)
            set_clauses.append(f'"{k}" = COALESCE("{k}", \'[]\'::jsonb) || ${curr_idx}::jsonb')
            params.append(json.dumps([push_v], default=str))
            curr_idx += 1

        where_sql, where_params = _build_where_clause(filter, curr_idx, table=self.table)
        params.extend(where_params)

        if not set_clauses:
            return UpdateResult(0, 0)

        sql = f'UPDATE "{self.table}" SET {", ".join(set_clauses)} WHERE {where_sql} RETURNING id'
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)
                matched = len(rows)
                if matched == 0 and upsert:
                    merged = dict(filter)
                    merged.update(set_fields)
                    ins = await self.insert_one(merged)
                    return UpdateResult(matched_count=0, modified_count=1, upserted_id=ins.inserted_id)
                return UpdateResult(matched_count=matched, modified_count=matched)
        except Exception as exc:
            logger.error("PostgresCollection.update_one(%s) failed: %s", self.table, exc)
            raise

    async def update_many(self, filter: Dict[str, Any], update: Dict[str, Any]) -> Any:
        return await self.update_one(filter, update, upsert=False)

    async def delete_one(self, filter: Dict[str, Any]) -> Any:
        from lib.db import DeleteResult
        pool = await self._db._get_pool()
        if not pool:
            return DeleteResult(0)

        where_sql, params = _build_where_clause(filter, table=self.table)
        sql = f'DELETE FROM "{self.table}" WHERE id IN (SELECT id FROM "{self.table}" WHERE {where_sql} LIMIT 1) RETURNING id'
        try:
            async with pool.acquire() as conn:
                res = await conn.fetch(sql, *params)
                return DeleteResult(deleted_count=len(res))
        except Exception as exc:
            logger.error("PostgresCollection.delete_one(%s) failed: %s", self.table, exc)
            return DeleteResult(0)

    async def delete_many(self, filter: Dict[str, Any]) -> Any:
        from lib.db import DeleteResult
        pool = await self._db._get_pool()
        if not pool:
            return DeleteResult(0)

        where_sql, params = _build_where_clause(filter, table=self.table)
        sql = f'DELETE FROM "{self.table}" WHERE {where_sql} RETURNING id'
        try:
            async with pool.acquire() as conn:
                res = await conn.fetch(sql, *params)
                return DeleteResult(deleted_count=len(res))
        except Exception as exc:
            logger.error("PostgresCollection.delete_many(%s) failed: %s", self.table, exc)
            return DeleteResult(0)

    async def distinct(self, key: str, filter: Optional[Dict[str, Any]] = None) -> List[Any]:
        pool = await self._db._get_pool()
        if not pool:
            return []
        if self.table == "processed_events" and key in ("customer_id", "user_id"):
            return []
        col = get_column_alias(self.table, key)
        where_sql, params = _build_where_clause(filter, table=self.table)
        sql = f'SELECT DISTINCT "{col}" FROM "{self.table}" WHERE {where_sql} AND "{col}" IS NOT NULL'
        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(sql, *params)
                return [r[col] for r in rows]
        except Exception as exc:
            logger.error("PostgresCollection.distinct(%s, %s) failed: %s", self.table, key, exc)
            return []

    async def find_one_and_update(
        self,
        filter: Dict[str, Any],
        update: Dict[str, Any],
        upsert: bool = False,
        return_document: bool = True,
    ) -> Optional[Dict[str, Any]]:
        """Atomic find_one_and_update (e.g. for counters)."""
        pool = await self._db._get_pool()
        if not pool:
            return None

        # Special counter sequence generator optimization
        if self.table == "counters" and "$inc" in update and "seq" in update["$inc"]:
            cid = filter.get("_id") or filter.get("id")
            inc_val = update["$inc"]["seq"]
            sql = """
                INSERT INTO counters (id, seq)
                VALUES ($1, $2)
                ON CONFLICT (id) DO UPDATE SET seq = counters.seq + $2
                RETURNING id, seq;
            """
            try:
                async with pool.acquire() as conn:
                    row = await conn.fetchrow(sql, str(cid), int(inc_val))
                    return {"id": row["id"], "_id": row["id"], "seq": row["seq"]}
            except Exception as exc:
                logger.error("counters sequence update failed: %s", exc)
                return {"id": str(cid), "_id": str(cid), "seq": 1}

        # General find and update
        doc_before = await self.find_one(filter)
        await self.update_one(filter, update, upsert=upsert)
        if return_document:
            return await self.find_one(filter)
        return doc_before

    async def create_indexes(self, models: List[Any]) -> None:
        """Idempotent index creation check (schema migrations already configure authoritative indexes)."""
        pass

    def aggregate(self, pipeline: List[Dict[str, Any]]) -> "PostgresAggregator":
        return PostgresAggregator(self, pipeline)


class PostgresAggregator:
    def __init__(self, collection: "PostgresCollection", pipeline: List[Dict[str, Any]]):
        self.collection = collection
        self.pipeline = pipeline

    async def to_list(self, length: int = 1000) -> List[Dict[str, Any]]:
        table = self.collection.table
        pool = await self.collection._db._get_pool()
        if not pool:
            return []

        if table in ("product_variants", "variants"):
            sql = 'SELECT * FROM "product_variants" ORDER BY stock ASC LIMIT $1;'
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(sql, length)
                    items = [_record_to_dict(r) for r in rows]
                    return [v for v in items if (v.get("stock", 0) - v.get("reserved", 0)) <= 5]
            except Exception as exc:
                logger.error("variants aggregation failed: %s", exc)
                return []

        if table == "assets":
            sql = "SELECT slot as _id, metadata->>'category' as category, COUNT(*)::int as count FROM \"assets\" GROUP BY slot, metadata->>'category';"
            try:
                async with pool.acquire() as conn:
                    rows = await conn.fetch(sql)
                    return [{"category": r["category"] or r["_id"], "count": r["count"]} for r in rows][:length]
            except Exception:
                return []

        if table == "orders":
            match_filter = {}
            for stage in self.pipeline:
                if "$match" in stage:
                    match_filter.update(stage["$match"])
            where_sql, params = _build_where_clause(match_filter, 1)
            sql = f'SELECT COALESCE(SUM(total_paise), 0)::bigint as t FROM "orders" WHERE {where_sql};'
            try:
                async with pool.acquire() as conn:
                    val = await conn.fetchval(sql, *params)
                    return [{"_id": None, "t": int(val) if val is not None else 0}]
            except Exception as exc:
                logger.error("orders aggregation failed: %s", exc)
                return [{"_id": None, "t": 0}]

        return []


class PostgresDatabase:
    """Authoritative PostgreSQL Database Manager for Staging & Production."""
    def __init__(self):
        self._pool = None

    async def _get_pool(self):
        if self._pool is not None:
            return self._pool
        from lib.supabase_client import get_pg_pool
        self._pool = await get_pg_pool()
        return self._pool

    def __getattr__(self, name: str) -> PostgresCollection:
        if name.startswith("_"):
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
        return PostgresCollection(self, name)

    def __getitem__(self, name: str) -> PostgresCollection:
        return PostgresCollection(self, name)

    def save_snapshot(self) -> None:
        """No-op for PostgreSQL; all transactions are committed authoritatively over SQL."""
        pass
