CREATE TABLE staff_advisor_rooms (
  username TEXT NOT NULL COLLATE NOCASE REFERENCES staff(username) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK(grade IN ('ม.1','ม.2','ม.3','ม.4','ม.5','ม.6')),
  room TEXT NOT NULL,
  PRIMARY KEY(username,grade,room)
);
INSERT INTO staff_advisor_rooms(username,grade,room)
SELECT username,advisor_grade,advisor_room FROM staff;
