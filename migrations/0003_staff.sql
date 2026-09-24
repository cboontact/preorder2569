CREATE TABLE staff (
  username TEXT PRIMARY KEY COLLATE NOCASE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('superadmin','teacher')),
  advisor_grade TEXT NOT NULL CHECK(advisor_grade IN ('ม.1','ม.2','ม.3','ม.4','ม.5','ม.6')),
  advisor_room TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  password_hash TEXT,
  CHECK(role = 'superadmin' OR password_hash IS NOT NULL)
);
-- The superadmin password remains in the existing Cloudflare Secret.
INSERT INTO staff(username,full_name,role,advisor_grade,advisor_room,active)
VALUES('cboonta','นายชลนที บุญทา','superadmin','ม.3','4',1);
CREATE INDEX idx_students_class ON students(grade,room);
