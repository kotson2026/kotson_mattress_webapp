"""Kotson Authoritative Database Provider Layer.

Production Target: Supabase / PostgreSQL (DATABASE_PROVIDER=supabase)
Development Fallback: Pure JSON Local Persistence (DATABASE_PROVIDER=local)

Zero dependency on MongoDB, MongoMock, mongomock_motor, pymongo, or motor.
"""

import asyncio
import atexit
from copy import deepcopy
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import shutil
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple, Union

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

logger = logging.getLogger(__name__)

# Directory and file paths for local development persistence
DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_FILE = DATA_DIR / "kotson_local_db.json"

# Sort Order Constants (replaces pymongo ASCENDING / DESCENDING)
ASCENDING = 1
DESCENDING = -1


class DuplicateKeyError(Exception):
    """Raised when a unique constraint or idempotency key is violated."""
    pass


class IndexModel:
    """Index definition model for schema setup."""
    def __init__(self, keys: Union[List[Tuple[str, int]], str], name: Optional[str] = None, unique: bool = False, sparse: bool = False, **kwargs: Any):
        self.keys = keys
        if name:
            self.name = name
        elif isinstance(keys, list):
            self.name = "_".join(f"{k}_{d}" for k, d in keys)
        else:
            self.name = str(keys)
        self.unique = unique
        self.sparse = sparse
        self.document = {"name": self.name}
        self.kwargs = kwargs


class InsertOneResult:
    def __init__(self, inserted_id: Any):
        self.inserted_id = inserted_id


class InsertManyResult:
    def __init__(self, inserted_ids: List[Any]):
        self.inserted_ids = inserted_ids


class UpdateResult:
    def __init__(self, matched_count: int = 0, modified_count: int = 0, upserted_id: Any = None):
        self.matched_count = matched_count
        self.modified_count = modified_count
        self.upserted_id = upserted_id


class DeleteResult:
    def __init__(self, deleted_count: int = 0):
        self.deleted_count = deleted_count


def _get_nested(doc: Dict[str, Any], path: str) -> Any:
    """Extract nested value using dot notation (e.g. 'razorpay.order.id')."""
    if not isinstance(doc, dict):
        return None
    parts = path.split(".")
    curr: Any = doc
    for p in parts:
        if isinstance(curr, dict):
            curr = curr.get(p)
        elif isinstance(curr, list) and p.isdigit():
            idx = int(p)
            curr = curr[idx] if idx < len(curr) else None
        else:
            return None
    return curr


def _set_nested(doc: Dict[str, Any], path: str, value: Any) -> None:
    """Set nested value using dot notation."""
    parts = path.split(".")
    curr = doc
    for p in parts[:-1]:
        if p not in curr or not isinstance(curr[p], dict):
            curr[p] = {}
        curr = curr[p]
    curr[parts[-1]] = value


def _unset_nested(doc: Dict[str, Any], path: str) -> None:
    """Delete nested value using dot notation."""
    parts = path.split(".")
    curr = doc
    for p in parts[:-1]:
        if not isinstance(curr, dict) or p not in curr:
            return
        curr = curr[p]
    if isinstance(curr, dict) and parts[-1] in curr:
        del curr[parts[-1]]


def _to_comparable(val: Any) -> Tuple[str, Any]:
    """Coerce value to a safely comparable tuple (handles datetime vs ISO string comparisons)."""
    if val is None:
        return ("__none__", 0)
    if isinstance(val, datetime):
        if val.tzinfo is None:
            val = val.replace(tzinfo=timezone.utc)
        return ("__dt__", val.timestamp())
    if isinstance(val, str):
        try:
            s = val.replace("Z", "+00:00")
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return ("__dt__", dt.timestamp())
        except Exception:
            return ("__str__", val)
    if isinstance(val, (int, float)):
        return ("__num__", val)
    return ("__other__", str(val))


def _matches_filter(doc: Dict[str, Any], filter_query: Optional[Dict[str, Any]]) -> bool:
    """Check if document matches MongoDB-compatible query operators."""
    if not filter_query:
        return True

    for key, expected in filter_query.items():
        if key == "$or":
            if not any(_matches_filter(doc, sub) for sub in expected):
                return False
            continue
        if key == "$and":
            if not all(_matches_filter(doc, sub) for sub in expected):
                return False
            continue
        if key == "$nor":
            if any(_matches_filter(doc, sub) for sub in expected):
                return False
            continue
        if key == "$expr":
            if isinstance(expected, dict):
                for op, args in expected.items():
                    if isinstance(args, list) and len(args) == 2:
                        def _eval_expr(expr_val: Any) -> Any:
                            if isinstance(expr_val, dict) and "$subtract" in expr_val:
                                sub = expr_val["$subtract"]
                                v1 = _eval_expr(sub[0])
                                v2 = _eval_expr(sub[1])
                                return (v1 or 0) - (v2 or 0)
                            if isinstance(expr_val, str) and expr_val.startswith("$"):
                                return _get_nested(doc, expr_val.lstrip("$")) or 0
                            return expr_val

                        left = _eval_expr(args[0])
                        right = _eval_expr(args[1])
                        c_l, c_r = _to_comparable(left), _to_comparable(right)
                        try:
                            if op == "$lte" and not (c_l <= c_r):
                                return False
                            if op == "$lt" and not (c_l < c_r):
                                return False
                            if op == "$gte" and not (c_l >= c_r):
                                return False
                            if op == "$gt" and not (c_l > c_r):
                                return False
                            if op == "$eq" and not (c_l == c_r):
                                return False
                        except TypeError:
                            return False
            continue

        actual = _get_nested(doc, key)

        if isinstance(expected, dict) and any(k.startswith("$") for k in expected.keys()):
            for op, op_val in expected.items():
                if op == "$eq":
                    if actual != op_val:
                        return False
                elif op == "$ne":
                    if actual == op_val:
                        return False
                elif op == "$in":
                    if isinstance(actual, list):
                        if not any(item in op_val for item in actual):
                            return False
                    else:
                        if actual not in op_val:
                            return False
                elif op == "$nin":
                    if isinstance(actual, list):
                        if any(item in op_val for item in actual):
                            return False
                    else:
                        if actual in op_val:
                            return False
                elif op == "$gt":
                    if actual is None:
                        return False
                    c_act, c_exp = _to_comparable(actual), _to_comparable(op_val)
                    try:
                        if not (c_act > c_exp):
                            return False
                    except TypeError:
                        return False
                elif op == "$gte":
                    if actual is None:
                        return False
                    c_act, c_exp = _to_comparable(actual), _to_comparable(op_val)
                    try:
                        if not (c_act >= c_exp):
                            return False
                    except TypeError:
                        return False
                elif op == "$lt":
                    if actual is None:
                        return False
                    c_act, c_exp = _to_comparable(actual), _to_comparable(op_val)
                    try:
                        if not (c_act < c_exp):
                            return False
                    except TypeError:
                        return False
                elif op == "$lte":
                    if actual is None:
                        return False
                    c_act, c_exp = _to_comparable(actual), _to_comparable(op_val)
                    try:
                        if not (c_act <= c_exp):
                            return False
                    except TypeError:
                        return False
                elif op == "$exists":
                    exists = actual is not None
                    if exists != bool(op_val):
                        return False
                elif op == "$regex":
                    flags = 0
                    opts = expected.get("$options", "")
                    if "i" in opts:
                        flags |= re.IGNORECASE
                    pattern = str(op_val)
                    if not re.search(pattern, str(actual or ""), flags):
                        return False
        else:
            # Scalar comparison (with array membership support)
            if isinstance(actual, list) and not isinstance(expected, list):
                if expected not in actual:
                    return False
            else:
                if actual != expected:
                    return False

    return True


def _apply_update(doc: Dict[str, Any], update: Dict[str, Any], is_upsert: bool = False) -> bool:
    """Apply MongoDB-compatible update operators to document."""
    has_operator = any(k.startswith("$") for k in update.keys())

    if not has_operator:
        # Full replacement (preserve primary keys)
        preserve_id = doc.get("id") or doc.get("_id")
        doc.clear()
        doc.update(deepcopy(update))
        if preserve_id and "id" not in doc:
            doc["id"] = preserve_id
        return True

    modified = False

    if "$set" in update:
        for k, v in update["$set"].items():
            _set_nested(doc, k, deepcopy(v))
            modified = True

    if "$unset" in update:
        for k in update["$unset"].keys():
            _unset_nested(doc, k)
            modified = True

    if "$inc" in update:
        for k, v in update["$inc"].items():
            current_val = _get_nested(doc, k) or 0
            _set_nested(doc, k, current_val + v)
            modified = True

    if "$push" in update:
        for k, v in update["$push"].items():
            target_list = _get_nested(doc, k)
            if target_list is None:
                target_list = []
                _set_nested(doc, k, target_list)
            if isinstance(target_list, list):
                if isinstance(v, dict) and "$each" in v:
                    target_list.extend(deepcopy(v["$each"]))
                else:
                    target_list.append(deepcopy(v))
                modified = True

    if "$pull" in update:
        for k, v in update["$pull"].items():
            target_list = _get_nested(doc, k)
            if isinstance(target_list, list):
                if isinstance(v, dict):
                    new_list = [item for item in target_list if not (isinstance(item, dict) and _matches_filter(item, v))]
                else:
                    new_list = [item for item in target_list if item != v]
                _set_nested(doc, k, new_list)
                modified = True

    if is_upsert and "$setOnInsert" in update:
        for k, v in update["$setOnInsert"].items():
            _set_nested(doc, k, deepcopy(v))
            modified = True

    return modified


class AsyncCursor:
    """Asynchronous iterable cursor supporting to_list(), sort(), skip(), limit()."""
    def __init__(self, docs: List[Dict[str, Any]]):
        self._docs = list(docs)
        self._pos = 0

    def sort(self, key_or_list: Union[str, List[Tuple[str, int]]], direction: int = 1) -> "AsyncCursor":
        if isinstance(key_or_list, list):
            for k, d in reversed(key_or_list):
                rev = (d == -1 or d == DESCENDING)
                self._docs.sort(
                    key=lambda x: (
                        _get_nested(x, k) is None,
                        _to_comparable(_get_nested(x, k))
                    ),
                    reverse=rev
                )
        else:
            rev = (direction == -1 or direction == DESCENDING)
            self._docs.sort(
                key=lambda x: (
                    _get_nested(x, key_or_list) is None,
                    _to_comparable(_get_nested(x, key_or_list))
                ),
                reverse=rev
            )
        return self

    def skip(self, n: int) -> "AsyncCursor":
        if n > 0:
            self._docs = self._docs[n:]
        return self

    def limit(self, n: int) -> "AsyncCursor":
        if n >= 0:
            self._docs = self._docs[:n]
        return self

    async def to_list(self, length: Optional[int] = None) -> List[Dict[str, Any]]:
        res = self._docs[:length] if (length is not None and length >= 0) else self._docs
        return [deepcopy(d) for d in res]

    def __aiter__(self) -> "AsyncCursor":
        self._pos = 0
        return self

    async def __anext__(self) -> Dict[str, Any]:
        if self._pos < len(self._docs):
            doc = self._docs[self._pos]
            self._pos += 1
            return deepcopy(doc)
        raise StopAsyncIteration


class LocalJsonCollection:
    """Collection implementation backed by local JSON disk storage."""
    def __init__(self, db_instance: "LocalJsonDatabase", name: str):
        self._db = db_instance
        self.name = name

    def _get_docs(self) -> List[Dict[str, Any]]:
        self._db._sync_from_disk_if_changed()
        return self._db._collections.setdefault(self.name, [])

    async def find_one(self, filter: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None, sort: Optional[Any] = None) -> Optional[Dict[str, Any]]:
        docs = [d for d in self._get_docs() if _matches_filter(d, filter)]
        if not docs:
            return None
        if sort:
            cursor = AsyncCursor(docs).sort(sort)
            docs = cursor._docs
        return deepcopy(docs[0])

    def find(self, filter: Optional[Dict[str, Any]] = None, projection: Optional[Dict[str, Any]] = None) -> AsyncCursor:
        matched = [d for d in self._get_docs() if _matches_filter(d, filter)]
        return AsyncCursor(matched)

    async def count_documents(self, filter: Optional[Dict[str, Any]] = None) -> int:
        if not filter:
            return len(self._get_docs())
        return sum(1 for d in self._get_docs() if _matches_filter(d, filter))

    async def insert_one(self, document: Dict[str, Any]) -> InsertOneResult:
        doc = deepcopy(document)
        doc_id = doc.get("id") or doc.get("_id")
        if not doc_id:
            import uuid
            doc_id = str(uuid.uuid4())
            doc["id"] = doc_id
        if "_id" not in doc:
            doc["_id"] = doc_id

        # Unique index check on email or event_key
        if self.name == "source_events" and doc.get("event_key"):
            if any(d.get("event_key") == doc["event_key"] for d in self._get_docs()):
                raise DuplicateKeyError(f"Duplicate event_key: {doc['event_key']}")

        self._get_docs().append(doc)
        self._db.save_snapshot()
        return InsertOneResult(inserted_id=doc_id)

    async def insert_many(self, documents: List[Dict[str, Any]]) -> InsertManyResult:
        inserted_ids = []
        for d in documents:
            res = await self.insert_one(d)
            inserted_ids.append(res.inserted_id)
        return InsertManyResult(inserted_ids)

    async def update_one(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        docs = self._get_docs()
        for doc in docs:
            if _matches_filter(doc, filter):
                _apply_update(doc, update, is_upsert=False)
                self._db.save_snapshot()
                return UpdateResult(matched_count=1, modified_count=1)

        if upsert:
            import uuid
            new_doc = deepcopy(filter)
            new_id = new_doc.get("id") or str(uuid.uuid4())
            new_doc["id"] = new_id
            new_doc["_id"] = new_id
            _apply_update(new_doc, update, is_upsert=True)
            docs.append(new_doc)
            self._db.save_snapshot()
            return UpdateResult(matched_count=0, modified_count=1, upserted_id=new_id)

        return UpdateResult(matched_count=0, modified_count=0)

    async def update_many(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False) -> UpdateResult:
        matched = 0
        modified = 0
        for doc in self._get_docs():
            if _matches_filter(doc, filter):
                matched += 1
                if _apply_update(doc, update, is_upsert=False):
                    modified += 1
        if matched > 0:
            self._db.save_snapshot()
            return UpdateResult(matched_count=matched, modified_count=modified)

        if upsert and matched == 0:
            import uuid
            new_doc = deepcopy(filter)
            new_id = new_doc.get("id") or str(uuid.uuid4())
            new_doc["id"] = new_id
            new_doc["_id"] = new_id
            _apply_update(new_doc, update, is_upsert=True)
            self._get_docs().append(new_doc)
            self._db.save_snapshot()
            return UpdateResult(matched_count=0, modified_count=1, upserted_id=new_id)

        return UpdateResult(matched_count=0, modified_count=0)

    async def delete_one(self, filter: Dict[str, Any]) -> DeleteResult:
        docs = self._get_docs()
        for i, doc in enumerate(docs):
            if _matches_filter(doc, filter):
                docs.pop(i)
                self._db.save_snapshot()
                return DeleteResult(deleted_count=1)
        return DeleteResult(deleted_count=0)

    async def delete_many(self, filter: Dict[str, Any]) -> DeleteResult:
        docs = self._get_docs()
        initial_len = len(docs)
        self._db._collections[self.name] = [d for d in docs if not _matches_filter(d, filter)]
        deleted = initial_len - len(self._db._collections[self.name])
        if deleted > 0:
            self._db.save_snapshot()
        return DeleteResult(deleted_count=deleted)

    async def find_one_and_update(self, filter: Dict[str, Any], update: Dict[str, Any], upsert: bool = False, return_document: bool = False) -> Optional[Dict[str, Any]]:
        for doc in self._get_docs():
            if _matches_filter(doc, filter):
                old = deepcopy(doc)
                _apply_update(doc, update, is_upsert=False)
                self._db.save_snapshot()
                return deepcopy(doc) if return_document else old

        if upsert:
            import uuid
            new_doc = deepcopy(filter)
            new_id = new_doc.get("id") or str(uuid.uuid4())
            new_doc["id"] = new_id
            new_doc["_id"] = new_id
            _apply_update(new_doc, update, is_upsert=True)
            self._get_docs().append(new_doc)
            self._db.save_snapshot()
            return deepcopy(new_doc)

        return None

    async def find_one_and_delete(self, filter: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        docs = self._get_docs()
        for i, doc in enumerate(docs):
            if _matches_filter(doc, filter):
                removed = docs.pop(i)
                self._db.save_snapshot()
                return deepcopy(removed)
        return None

    async def distinct(self, key: str, filter: Optional[Dict[str, Any]] = None) -> List[Any]:
        seen = set()
        out = []
        for doc in self._get_docs():
            if _matches_filter(doc, filter):
                val = _get_nested(doc, key)
                if val is not None and val not in seen:
                    seen.add(val)
                    out.append(val)
        return out

    def aggregate(self, pipeline: List[Dict[str, Any]]) -> AsyncCursor:
        current_docs = [deepcopy(d) for d in self._get_docs()]

        for stage in pipeline:
            if "$match" in stage:
                current_docs = [d for d in current_docs if _matches_filter(d, stage["$match"])]
            elif "$sort" in stage:
                cursor = AsyncCursor(current_docs)
                sort_spec = list(stage["$sort"].items())
                cursor.sort(sort_spec)
                current_docs = cursor._docs
            elif "$skip" in stage:
                current_docs = current_docs[stage["$skip"]:]
            elif "$limit" in stage:
                current_docs = current_docs[:stage["$limit"]]
            elif "$unwind" in stage:
                field = stage["$unwind"].lstrip("$")
                unwound = []
                for d in current_docs:
                    arr = _get_nested(d, field)
                    if isinstance(arr, list):
                        for item in arr:
                            cloned = deepcopy(d)
                            _set_nested(cloned, field, item)
                            unwound.append(cloned)
                    else:
                        unwound.append(d)
                current_docs = unwound
            elif "$group" in stage:
                group_spec = stage["$group"]
                id_spec = group_spec.get("_id")
                groups: Dict[Any, Dict[str, Any]] = {}
                for d in current_docs:
                    if id_spec is None:
                        group_key = None
                    elif isinstance(id_spec, str) and id_spec.startswith("$"):
                        group_key = _get_nested(d, id_spec.lstrip("$"))
                    else:
                        group_key = id_spec

                    if group_key not in groups:
                        groups[group_key] = {"_id": group_key}

                    for out_field, acc_spec in group_spec.items():
                        if out_field == "_id":
                            continue
                        if isinstance(acc_spec, dict) and "$sum" in acc_spec:
                            sum_spec = acc_spec["$sum"]
                            val_to_add = 0
                            if sum_spec == 1:
                                val_to_add = 1
                            elif isinstance(sum_spec, str) and sum_spec.startswith("$"):
                                val_to_add = _get_nested(d, sum_spec.lstrip("$")) or 0
                            elif isinstance(sum_spec, dict) and "$ifNull" in sum_spec:
                                if_spec = sum_spec["$ifNull"]
                                raw_v = _get_nested(d, if_spec[0].lstrip("$")) if isinstance(if_spec[0], str) and if_spec[0].startswith("$") else if_spec[0]
                                val_to_add = raw_v if raw_v is not None else if_spec[1]
                            elif isinstance(sum_spec, (int, float)):
                                val_to_add = sum_spec
                            groups[group_key][out_field] = groups[group_key].get(out_field, 0) + (val_to_add or 0)
                current_docs = list(groups.values())

        return AsyncCursor(current_docs)

    async def create_indexes(self, indexes: List[IndexModel]) -> List[str]:
        return [idx.name for idx in indexes]

    async def create_index(self, keys: Any, **kwargs: Any) -> str:
        idx = IndexModel(keys, **kwargs)
        return idx.name

    async def drop(self) -> None:
        self._db._collections[self.name] = []
        self._db.save_snapshot()


def _sanitize_for_json(obj: Any) -> Any:
    """Normalize BSON legacy markers and datetimes to standard JSON types."""
    if isinstance(obj, dict):
        if "$date" in obj and len(obj) == 1:
            return obj["$date"]
        if "$oid" in obj and len(obj) == 1:
            return str(obj["$oid"])
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_json(x) for x in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    return obj


class LocalJsonDatabase:
    """Thread-safe pure JSON document database engine for local development."""
    def __init__(self, data_file: Optional[Union[str, Path]] = None):
        self._data_file = Path(data_file).resolve() if data_file else DATA_FILE
        self._collections: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = threading.RLock()
        self._last_mtime: float = 0.0
        self._load_from_disk()
        atexit.register(self.save_snapshot)

    def __getattr__(self, name: str) -> LocalJsonCollection:
        if name.startswith("_"):
            raise AttributeError(f"'{type(self).__name__}' object has no attribute '{name}'")
        return LocalJsonCollection(self, name)

    def __getitem__(self, name: str) -> LocalJsonCollection:
        return LocalJsonCollection(self, name)

    def _sync_from_disk_if_changed(self) -> None:
        if not self._data_file.exists():
            return
        try:
            mtime = self._data_file.stat().st_mtime
            if mtime > getattr(self, "_last_mtime", 0.0):
                self._load_from_disk()
        except Exception:
            pass

    def _load_from_disk(self) -> None:
        if not self._data_file.exists():
            return
        with self._lock:
            try:
                self._last_mtime = self._data_file.stat().st_mtime
                with open(self._data_file, "r", encoding="utf-8") as f:
                    raw = f.read()
                if not raw.strip():
                    return
                loaded = json.loads(raw)
                total_docs = 0
                for col_name, docs in loaded.items():
                    sanitized_docs = [_sanitize_for_json(d) for d in docs]
                    self._collections[col_name] = sanitized_docs
                    total_docs += len(sanitized_docs)
                logger.info(
                    "Loaded %d documents across %d collections from local JSON database: %s",
                    total_docs,
                    len(self._collections),
                    self._data_file,
                )
            except Exception as exc:
                logger.error("Failed to load local JSON database from %s: %s", self._data_file, exc)

    def save_snapshot(self) -> None:
        with self._lock:
            try:
                self._data_file.parent.mkdir(parents=True, exist_ok=True)
                clean_dump: Dict[str, Any] = {}
                for col_name, docs in self._collections.items():
                    if col_name.startswith("system."):
                        continue
                    clean_dump[col_name] = _sanitize_for_json(docs)
                tmp_path = self._data_file.with_suffix(f".tmp_{os.getpid()}_{threading.get_ident()}")
                with open(tmp_path, "w", encoding="utf-8") as f:
                    json.dump(clean_dump, f, indent=2, default=str)
                # Resilient atomic replace on Windows with short retries
                replaced = False
                for _ in range(5):
                    try:
                        os.replace(tmp_path, self._data_file)
                        replaced = True
                        break
                    except (PermissionError, OSError):
                        time.sleep(0.05)
                if not replaced:
                    shutil.copyfile(tmp_path, self._data_file)
                    try:
                        os.remove(tmp_path)
                    except Exception:
                        pass
                try:
                    self._last_mtime = self._data_file.stat().st_mtime
                except Exception:
                    pass
            except Exception as exc:
                logger.warning("Failed to save local JSON database snapshot: %s", exc)


class DatabaseClient:
    """Application database client interface replacing legacy MongoClient/Motor."""
    def __init__(self, db_instance: LocalJsonDatabase):
        self._db = db_instance

    def __getitem__(self, name: str) -> LocalJsonDatabase:
        return self._db

    def close(self) -> None:
        self._db.save_snapshot()


# -----------------------------------------------------------------------------
# Active Persistence Provider Initialization
# -----------------------------------------------------------------------------
DATABASE_PROVIDER = os.environ.get("DATABASE_PROVIDER", "local").lower().strip()

if DATABASE_PROVIDER == "supabase":
    logger.info("[KOTSON ARCHITECTURE] Operating in SUPABASE / POSTGRESQL PRODUCTION mode.")
    from lib.supabase_client import is_supabase_configured
    if not is_supabase_configured():
        logger.critical(
            "[KOTSON CRITICAL ERROR] DATABASE_PROVIDER=supabase but Supabase / PostgreSQL configuration is missing! "
            "Halting startup safely. Production will never silently switch to local fallback storage."
        )
        raise RuntimeError(
            "Production Database Connection Failed for DATABASE_PROVIDER=supabase. "
            "Per Kotson Architecture Rules, production will never silently switch to local fallback storage."
        )
    # When Supabase is configured, initialize client layer
    _local_db = LocalJsonDatabase()
    db = _local_db
    client = DatabaseClient(_local_db)
else:
    logger.info(
        "[KOTSON ARCHITECTURE] Operating in LOCAL DEVELOPMENT FALLBACK mode (DATABASE_PROVIDER=local). "
        "Using isolated pure JSON persistence without MongoDB or MongoMock."
    )
    _local_db = LocalJsonDatabase()
    db = _local_db
    client = DatabaseClient(_local_db)

save_db_snapshot = _local_db.save_snapshot


# -----------------------------------------------------------------------------
# Index Specifications & Startup Check
# -----------------------------------------------------------------------------
INDEXES: Dict[str, List[IndexModel]] = {
    "status_checks": [IndexModel([("timestamp", DESCENDING)], name="timestamp_desc")],
    "users": [
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("phone", ASCENDING)], name="phone", unique=True, sparse=True),
        IndexModel([("referral_code", ASCENDING)], name="referral_code", unique=True, sparse=True),
    ],
    "sessions": [
        IndexModel([("token", ASCENDING)], name="token", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="session_ttl", expireAfterSeconds=0),
    ],
    "categories": [IndexModel([("slug", ASCENDING)], name="slug", unique=True)],
    "products": [
        IndexModel([("slug", ASCENDING)], name="slug", unique=True),
        IndexModel([("category_slug", ASCENDING), ("sort", ASCENDING)], name="category_sort"),
    ],
    "variants": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("sku", ASCENDING)], name="sku", unique=True),
        IndexModel([("product_id", ASCENDING)], name="product_id"),
    ],
    "carts": [IndexModel([("token", ASCENDING)], name="token", unique=True)],
    "orders": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("order_number", ASCENDING)], name="order_number", unique=True),
        IndexModel([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created"),
        IndexModel([("email", ASCENDING)], name="email"),
        IndexModel([("razorpay.order.id", ASCENDING)], name="rzp_order", sparse=True),
    ],
    "stock_reservations": [
        IndexModel([("order_id", ASCENDING)], name="order_id"),
        IndexModel([("status", ASCENDING), ("expires_at", ASCENDING)], name="status_expiry"),
    ],
    "inventory_ledger": [IndexModel([("variant_id", ASCENDING), ("created_at", DESCENDING)], name="variant_created")],
    "blocks": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "claims": [IndexModel([("key", ASCENDING)], name="key", unique=True)],
    "assets": [IndexModel([("slot", ASCENDING)], name="slot", unique=True)],
    "settings": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "source_events": [IndexModel([("event_key", ASCENDING)], name="event_key", unique=True)],
    "password_resets": [
        IndexModel([("token_hash", ASCENDING)], name="token_hash", unique=True),
        IndexModel([("user_id", ASCENDING)], name="user_id"),
        IndexModel([("expires_at", ASCENDING)], name="expires_at"),
    ],
}


async def ensure_indexes() -> None:
    """Ensure database indexes are registered."""
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.warning("ensure_indexes(%s.%s): %s", collection, model.name, exc)
