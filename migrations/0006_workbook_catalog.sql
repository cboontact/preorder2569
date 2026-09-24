-- Source: อุปกรณ์การเรียนใบเสร็จ 3.xlsx, ใบสั่งซื้อ!A4:C25 (22 products).
-- Spreadsheet numbers are display numbers, not product IDs; number 17 is absent.
-- Keep product IDs and historical order item snapshots. Only trim/collapse whitespace.
UPDATE products SET active=0 WHERE product_id NOT IN (1,2,3,6,8,10,11,12,14,15,16,17,20,21,22,23,24,26,27,28,29,30);
UPDATE products SET name='สมุดเล่มใหญ่',price=20,active=1 WHERE product_id=1;
UPDATE products SET name='สมุดเล่มเล็ก',price=10,active=1 WHERE product_id=2;
UPDATE products SET name='สมุดรายงาน จำนวน 40 แผ่น',price=20,active=1 WHERE product_id=3;
UPDATE products SET name='ปากกาหมึกซึม Uni',price=20,active=1 WHERE product_id=6;
UPDATE products SET name='ไม้บรรทัดอลูมิเนียมเล็ก ความยาว 30 เซนติเมตร',price=20,active=1 WHERE product_id=8;
UPDATE products SET name='น้ำยาลบคำผิด',price=25,active=1 WHERE product_id=10;
UPDATE products SET name='สีไม้ระบายน้ำ colleen 12 สี',price=75,active=1 WHERE product_id=11;
UPDATE products SET name='แฟ้มพลาสติก',price=35,active=1 WHERE product_id=12;
UPDATE products SET name='กาวสองหน้า บาง',price=15,active=1 WHERE product_id=14;
UPDATE products SET name='กาว 4 ออนซ์',price=20,active=1 WHERE product_id=15;
UPDATE products SET name='ที่เย็บกระดาษ-เล็ก ตราม้า',price=55,active=1 WHERE product_id=16;
UPDATE products SET name='สมุดวาดเขียนเล่มใหญ่',price=20,active=1 WHERE product_id=17;
UPDATE products SET name='ชุดเรขาคณิต',price=25,active=1 WHERE product_id=20;
UPDATE products SET name='สีโปสเตอร์จิตรกรน้อย ชุด 6 สี',price=90,active=1 WHERE product_id=21;
UPDATE products SET name='ปากาเน้นคำ',price=25,active=1 WHERE product_id=22;
UPDATE products SET name='กระดาษ Post it',price=30,active=1 WHERE product_id=23;
UPDATE products SET name='ไม้แบดมินตัน grand',price=165,active=1 WHERE product_id=24;
UPDATE products SET name='ตะกร้อ',price=70,active=1 WHERE product_id=26;
UPDATE products SET name='กระเป๋านักเรียนใบเล็ก',price=150,active=1 WHERE product_id=27;
UPDATE products SET name='ถุงเท้า',price=25,active=1 WHERE product_id=28;
UPDATE products SET name='โบว์ ม.ต้น 2 ชิ้น',price=60,active=1 WHERE product_id=29;
UPDATE products SET name='โบว์ ม.ปลาย',price=35,active=1 WHERE product_id=30;
