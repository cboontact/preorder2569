"""Validate a school CSV and prepare INSERT-only SQL. Does not connect to D1."""
import argparse
import collections
import csv
import hashlib
import json
import re
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
required = ["เลขประจำตัว", "คำนำหน้า", "ชื่อ", "นามสกุล", "ระดับชั้น", "ห้อง"]
students = []
seen = set()
with args.source.open(encoding="utf-8-sig", newline="") as source:
    reader = csv.DictReader(source)
    if not set(required).issubset(reader.fieldnames or []):
        raise ValueError("Missing required CSV columns")
    for line, row in enumerate(reader, 2):
        values = {key: (row.get(key) or "").strip() for key in required}
        sid, grade, room = values["เลขประจำตัว"], values["ระดับชั้น"], values["ห้อง"]
        valid = (None not in row and re.fullmatch(r"[0-9]{5}", sid)
                 and sid not in seen and grade in {"1", "2", "3", "4", "5", "6"}
                 and re.fullmatch(r"[1-9][0-9]?", room)
                 and len(values["คำนำหน้า"]) <= 50
                 and 2 <= len(values["ชื่อ"]) <= 120
                 and 1 <= len(values["นามสกุล"]) <= 120)
        if not valid:
            raise ValueError(f"Invalid or duplicate student at CSV line {line}")
        seen.add(sid)
        students.append((sid, values["คำนำหน้า"], values["ชื่อ"], values["นามสกุล"],
                         "ม.ต้น" if int(grade) <= 3 else "ม.ปลาย", f"ม.{grade}", room))
if not students:
    raise ValueError("CSV has no students")

def sql_string(value):
    if "\x00" in value:
        raise ValueError("NUL is not allowed")
    return "'" + value.replace("'", "''") + "'"

sql = "-- Student import: INSERT only; duplicate IDs abort instead of overwriting.\n"
sql += "\n".join(
    "INSERT INTO students(student_id,prefix,first_name,last_name,level,grade,room) VALUES("
    + ",".join(map(sql_string, student)) + ");" for student in students
) + "\n"
with sqlite3.connect(":memory:") as db:
    db.execute("CREATE TABLE students(student_id TEXT PRIMARY KEY,prefix TEXT,first_name TEXT,last_name TEXT,level TEXT,grade TEXT,room TEXT)")
    db.executescript(sql)
    assert db.execute("SELECT * FROM students ORDER BY student_id").fetchall() == sorted(students)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(sql, encoding="utf-8")
args.output.chmod(0o600)
print(json.dumps({"students": len(students), "by_grade": dict(sorted(collections.Counter(s[5] for s in students).items())),
                  "classes": len({(s[5], s[6]) for s in students}),
                  "source_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
                  "sql_verified": True}, ensure_ascii=False))
