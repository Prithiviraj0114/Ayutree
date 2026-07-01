import os
import json
import re
import asyncio
import uuid
from pathlib import Path

DB_STORE_DIR = Path(__file__).parent / "db_store"
DB_STORE_DIR.mkdir(exist_ok=True)

class MockCursor:
    def __init__(self, data):
        self.data = data
        self.index = 0

    def sort(self, key, direction=-1):
        if isinstance(key, list):
            for k, d in reversed(key):
                self.data.sort(key=lambda x: x.get(k, ""), reverse=(d == -1))
        else:
            self.data.sort(key=lambda x: x.get(key, ""), reverse=(direction == -1))
        return self

    def limit(self, count):
        self.data = self.data[:count]
        return self

    async def to_list(self, length=None):
        if length is not None:
            return self.data[:length]
        return self.data

    def __aiter__(self):
        self.index = 0
        return self

    async def __anext__(self):
        if self.index < len(self.data):
            val = self.data[self.index]
            self.index += 1
            return val
        else:
            raise StopAsyncIteration

def match_filter(doc, filter_dict):
    if not filter_dict:
        return True
    for key, val in filter_dict.items():
        if key == "$or":
            if not any(match_filter(doc, sub_filter) for sub_filter in val):
                return False
            continue
        
        doc_val = doc.get(key)
        
        if isinstance(val, dict):
            for op, op_val in val.items():
                if op == "$regex":
                    options = val.get("$options", "")
                    flags = re.IGNORECASE if "i" in options else 0
                    if not isinstance(doc_val, str) or not re.search(op_val, doc_val, flags):
                        return False
                elif op == "$options":
                    pass
                elif op == "$in":
                    if isinstance(doc_val, list):
                        if not any(item in op_val for item in doc_val):
                            return False
                    else:
                        if doc_val not in op_val:
                            return False
                elif op == "$lt":
                    if doc_val is None or doc_val >= op_val:
                        return False
                elif op == "$gt":
                    if doc_val is None or doc_val <= op_val:
                        return False
                elif op == "$lte":
                    if doc_val is None or doc_val > op_val:
                        return False
                elif op == "$gte":
                    if doc_val is None or doc_val < op_val:
                        return False
        elif isinstance(val, list):
            if doc_val != val:
                return False
        else:
            if doc_val != val:
                return False
    return True

def apply_projection(doc, projection):
    if not projection:
        return dict(doc)
    
    inclusive = any(v == 1 for k, v in projection.items() if k != "_id")
    
    res = {}
    if inclusive:
        for k, v in projection.items():
            if v == 1 and k in doc:
                res[k] = doc[k]
        if projection.get("_id") != 0 and "_id" in doc:
            res["_id"] = doc["_id"]
    else:
        res = dict(doc)
        for k, v in projection.items():
            if v == 0:
                res.pop(k, None)
    return res

def apply_update(doc, update_dict):
    for op, val in update_dict.items():
        if op == "$set":
            for k, v in val.items():
                doc[k] = v
        elif op == "$inc":
            for k, v in val.items():
                doc[k] = doc.get(k, 0) + v
        elif op == "$push":
            for k, v in val.items():
                if k not in doc or not isinstance(doc[k], list):
                    doc[k] = []
                doc[k].append(v)

class MockCollection:
    def __init__(self, collection_name):
        self.name = collection_name
        self.filepath = DB_STORE_DIR / f"{collection_name}.json"
        self.docs = []
        self._load()

    def _load(self):
        if self.filepath.exists():
            try:
                with open(self.filepath, "r", encoding="utf-8") as f:
                    self.docs = json.load(f)
            except Exception:
                self.docs = []
        else:
            self.docs = []

    def _save(self):
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self.docs, f, indent=2, ensure_ascii=False)

    async def create_index(self, keys, unique=False):
        return True

    async def find_one(self, filter_dict=None, projection=None):
        self._load()
        for doc in self.docs:
            if match_filter(doc, filter_dict):
                return apply_projection(doc, projection)
        return None

    async def insert_one(self, doc):
        self._load()
        doc_copy = dict(doc)
        if "_id" not in doc_copy:
            doc_copy["_id"] = str(uuid.uuid4())
        self.docs.append(doc_copy)
        self._save()
        
        class InsertResult:
            def __init__(self, inserted_id):
                self.inserted_id = inserted_id
        return InsertResult(doc_copy["_id"])

    async def update_one(self, filter_dict, update_dict, upsert=False):
        self._load()
        matched = False
        for doc in self.docs:
            if match_filter(doc, filter_dict):
                apply_update(doc, update_dict)
                matched = True
                break
        
        if not matched and upsert:
            new_doc = {}
            for k, v in filter_dict.items():
                if not isinstance(v, dict):
                    new_doc[k] = v
            apply_update(new_doc, update_dict)
            if "_id" not in new_doc:
                new_doc["_id"] = str(uuid.uuid4())
            self.docs.append(new_doc)
            matched = True

        if matched:
            self._save()

        class UpdateResult:
            def __init__(self, matched_count, modified_count):
                self.matched_count = matched_count
                self.modified_count = modified_count
        return UpdateResult(1 if matched else 0, 1 if matched else 0)

    async def delete_one(self, filter_dict):
        self._load()
        idx_to_delete = None
        for idx, doc in enumerate(self.docs):
            if match_filter(doc, filter_dict):
                idx_to_delete = idx
                break
        if idx_to_delete is not None:
            self.docs.pop(idx_to_delete)
            self._save()
            deleted = 1
        else:
            deleted = 0

        class DeleteResult:
            def __init__(self, deleted_count):
                self.deleted_count = deleted_count
        return DeleteResult(deleted)

    async def count_documents(self, filter_dict=None):
        self._load()
        if not filter_dict:
            return len(self.docs)
        count = sum(1 for doc in self.docs if match_filter(doc, filter_dict))
        return count

    def find(self, filter_dict=None, projection=None):
        self._load()
        matched_docs = [apply_projection(doc, projection) for doc in self.docs if match_filter(doc, filter_dict)]
        return MockCursor(matched_docs)

    def aggregate(self, pipeline):
        self._load()
        has_unwind = any("$unwind" in stage for stage in pipeline)
        if has_unwind and self.name == "orders":
            unwound = []
            for doc in self.docs:
                for item in doc.get("items", []):
                    unwound.append({
                        "doc": doc,
                        "item": item
                    })
            groups = {}
            for row in unwound:
                pid = row["item"].get("product_id")
                name = row["item"].get("name")
                qty = row["item"].get("qty", 0)
                total = row["item"].get("total", 0.0)
                if pid not in groups:
                    groups[pid] = {
                        "_id": pid,
                        "name": name,
                        "qty": 0,
                        "revenue": 0.0
                    }
                groups[pid]["qty"] += qty
                groups[pid]["revenue"] += total
            results = list(groups.values())
            for stage in pipeline:
                if "$sort" in stage:
                    sort_field = list(stage["$sort"].keys())[0]
                    direction = stage["$sort"][sort_field]
                    results.sort(key=lambda x: x.get(sort_field, 0), reverse=(direction == -1))
                if "$limit" in stage:
                    limit_val = stage["$limit"]
                    results = results[:limit_val]
            return MockCursor(results)
        return MockCursor([])

class MockDatabase:
    def __init__(self):
        self._collections = {}

    def __getitem__(self, name):
        if name not in self._collections:
            self._collections[name] = MockCollection(name)
        return self._collections[name]

    def __getattr__(self, name):
        return self[name]

class MockAsyncIOMotorClient:
    def __init__(self, uri=None, **kwargs):
        self.uri = uri

    def __getitem__(self, name):
        return MockDatabase()

    def __getattr__(self, name):
        return self[name]

    def close(self):
        pass
