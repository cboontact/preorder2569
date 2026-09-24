PRAGMA foreign_keys=OFF;
CREATE TABLE staff_new (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin','admin','teacher')),
  advisor_grade TEXT NOT NULL CHECK(advisor_grade IN ('ม.1','ม.2','ม.3','ม.4','ม.5','ม.6')),
  advisor_room TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  password_hash TEXT,
  CHECK(role = 'superadmin' OR password_hash IS NOT NULL)
);
INSERT INTO staff_new SELECT username,full_name,role,advisor_grade,advisor_room,active,password_hash FROM staff;
CREATE TABLE staff_advisor_rooms_new (
  username TEXT NOT NULL COLLATE NOCASE REFERENCES staff_new(username) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK(grade IN ('ม.1','ม.2','ม.3','ม.4','ม.5','ม.6')),
  room TEXT NOT NULL,
  PRIMARY KEY(username,grade,room)
);
INSERT INTO staff_advisor_rooms_new SELECT username,grade,room FROM staff_advisor_rooms;
DROP TABLE staff_advisor_rooms;
DROP TABLE staff;
ALTER TABLE staff_new RENAME TO staff;
ALTER TABLE staff_advisor_rooms_new RENAME TO staff_advisor_rooms;
PRAGMA foreign_keys=ON;
