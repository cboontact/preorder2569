"""Prepare INSERT-only staff import; password equals the trimmed CSV Username."""
import argparse
import csv
import hashlib
import json
import re
import secrets
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('source', type=Path)
p.add_argument('output', type=Path)
a = p.parse_args()
teachers = {}
with a.source.open(encoding='utf-8-sig', newline='') as f:
    for line, row in enumerate(csv.DictReader(f), 2):
        username = row['Username'].strip()
        name = ' '.join(row['ชื่อ-นามสกุล'].split())
        grade, room = row['ระดับชั้น'].strip(), row['ห้อง'].strip()
        if (not re.fullmatch(r'[a-zA-Z0-9_.-]{3,40}', username)
                or grade not in {'ม.'+str(n) for n in range(1,7)}
                or not re.fullmatch(r'[1-9][0-9]?', room) or not 2 <= len(name) <= 200):
            raise ValueError(f'Invalid teacher on CSV line {line}')
        key = username.lower()
        teacher = teachers.setdefault(key, {'username':username, 'name':name, 'rooms':[]})
        if teacher['name'] != name or teacher['username'] != username:
            raise ValueError(f'Conflicting account on CSV line {line}')
        if (grade,room) not in teacher['rooms']:
            teacher['rooms'].append((grade,room))

def quote(s):
    if '\x00' in s: raise ValueError('NUL is not allowed')
    return "'"+s.replace("'","''")+"'"

sql = ['-- User-authorized advisor import. Password hashes only; no phone numbers.']
for key,t in teachers.items():
    if key == 'cboonta':
        if t['name'] != 'นายชลนที บุญทา' or t['rooms'] != [('ม.3','4')]:
            raise ValueError('Unexpected superadmin details; existing superadmin is protected')
        continue
    salt = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac('sha256',t['username'].encode(),salt,100000).hex()
    encoded = f'pbkdf2-sha256$100000${salt.hex()}${derived}'
    grade,room = t['rooms'][0]
    values = [t['username'],t['name'],'teacher',grade,room]
    sql.append('INSERT INTO staff(username,full_name,role,advisor_grade,advisor_room,active,password_hash) VALUES('+','.join(map(quote,values))+',1,'+quote(encoded)+');')
    for grade,room in t['rooms']:
        sql.append('INSERT INTO staff_advisor_rooms(username,grade,room) VALUES('+','.join(map(quote,[t['username'],grade,room]))+');')
a.output.parent.mkdir(parents=True,exist_ok=True)
a.output.write_text('\n'.join(sql)+'\n',encoding='utf-8')
a.output.chmod(0o600)
print(json.dumps({'accounts_in_file':len(teachers),'teachers_to_add':sum(k!='cboonta' for k in teachers),'assignments':sum(len(t['rooms']) for t in teachers.values()),'source_sha256':hashlib.sha256(a.source.read_bytes()).hexdigest()}))
