// Rank against the complete current classroom, independently of UI filters.
// Student IDs are fixed-width five-digit numbers, so text order is numeric order.
const genderOrder = (alias: "s" | "n") => `CASE WHEN trim(${alias}.prefix) IN ('เด็กชาย','ด.ช.','นาย') THEN 0 WHEN trim(${alias}.prefix) IN ('เด็กหญิง','ด.ญ.','นางสาว','น.ส.','นาง') THEN 1 ELSE 2 END`;
export const studentNumberSql = `(SELECT count(*) FROM students n WHERE n.grade=s.grade AND n.room=s.room AND (${genderOrder("n")} < ${genderOrder("s")} OR (${genderOrder("n")} = ${genderOrder("s")} AND n.student_id <= s.student_id)))`;
