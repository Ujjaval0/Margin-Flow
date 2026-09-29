-- ============================================================
-- MarginFlow — Step 06: Seed Data (from mock-data.ts)
-- Populates the database with the exact same initial data
-- that currently lives in mock-data.ts for testing.
-- Run AFTER 05_views.sql
-- ============================================================

-- ------------------------------------------------------------
-- SUPPLIERS
-- ------------------------------------------------------------
INSERT INTO suppliers (display_id, name, contact_person, email, phone, gstin, address, payment_terms, bank_account, upi_id, opening_balance, total_paid, notes)
VALUES
  ('SUP-001', 'Apex Electronics Mfg Ltd', 'Rajesh Sharma', 'orders@apexelectronics.in',
   '+91 98200 12345', '27AAACA1234A1Z5', 'Bhiwandi Industrial Area, Thane, Maharashtra',
   'Net 30', 'HDFC Bank - A/C 50200088912 (IFSC: HDFC0000123)', 'apex.mfg@okhdfcbank',
   0, 44840, 'Primary supplier for audio & wireless peripherals.'),

  ('SUP-002', 'Zenith Cable & Power Supplies', 'Vikram Mehta', 'supply@zenithpower.co.in',
   '+91 99300 67890', '24AABCS5678B1Z2', 'GIDC Industrial Estate, Ahmedabad, Gujarat',
   'Net 15', 'ICICI Bank - A/C 001205009871 (IFSC: ICIC0000012)', 'zenithpower@okicici',
   0, 24780, 'Supplier for chargers, cables, and adaptors.');

-- ------------------------------------------------------------
-- PRODUCTS
-- ------------------------------------------------------------
INSERT INTO products (display_id, sku, mfn, mfn1, name, category, brand, current_cost_price, active, stock_quantity,
  supplier_id)
VALUES
  ('PROD-01', 'ELEC-WEM-01', 'MFN-WEM-010', 'MFN1-WEM-010-A',
   'Wireless Ergonomic Mouse (Silent Click)', 'Computer Peripherals', 'VoltTech',
   380, TRUE, 92,
   (SELECT id FROM suppliers WHERE display_id = 'SUP-001')),

  ('PROD-02', 'ELEC-USBC-65W', 'MFN-CHG-065', 'MFN1-CHG-065-B',
   '65W GaN Fast Charger (Dual USB-C)', 'Mobile Accessories', 'VoltTech',
   420, TRUE, 46,
   (SELECT id FROM suppliers WHERE display_id = 'SUP-002')),

  ('PROD-03', 'ELEC-ANC-EB', 'MFN-ANC-900', 'MFN1-ANC-900-C',
   'Active Noise Cancelling TWS Earbuds', 'Audio', 'VoltTech',
   840, TRUE, 38,
   (SELECT id FROM suppliers WHERE display_id = 'SUP-001')),

  ('PROD-04', 'ELEC-BRAID-CBL', 'MFN-CBL-100', 'MFN1-CBL-100-D',
   'Braided 100W Type-C to Type-C Cable (2m)', 'Cables', 'VoltTech',
   110, TRUE, 185,
   (SELECT id FROM suppliers WHERE display_id = 'SUP-002'));

-- ------------------------------------------------------------
-- PRODUCT CHANNEL ALIASES
-- ------------------------------------------------------------
INSERT INTO product_channel_aliases (product_id, marketplace, alias_sku)
VALUES
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Amazon India'::marketplace_enum, 'B08WEM01-IND'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Flipkart'::marketplace_enum, 'FLIP-MOUSE-WEM'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Meesho'::marketplace_enum, 'MSHO-98311-MSE'),
  ((SELECT id FROM products WHERE sku = 'ELEC-WEM-01'), 'Personal Website'::marketplace_enum, 'VT-WEM-01'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Amazon India'::marketplace_enum, 'B09GAN65W-BLK'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Flipkart'::marketplace_enum, 'FLIP-CHG-65W'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Meesho'::marketplace_enum, 'MSHO-7721-CHG'),
  ((SELECT id FROM products WHERE sku = 'ELEC-USBC-65W'), 'Personal Website'::marketplace_enum, 'VT-CHG-65W'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'Amazon India'::marketplace_enum, 'B07TWSANC-PRO'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'Flipkart'::marketplace_enum, 'FLIP-TWS-ANC01'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'Meesho'::marketplace_enum, 'MSHO-5541-TWS'),
  ((SELECT id FROM products WHERE sku = 'ELEC-ANC-EB'), 'Personal Website'::marketplace_enum, 'VT-ANC-01'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Amazon India'::marketplace_enum, 'B08CBL100W-2M'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Flipkart'::marketplace_enum, 'FLIP-CBL-100W'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Meesho'::marketplace_enum, 'MSHO-1102-CBL'),
  ((SELECT id FROM products WHERE sku = 'ELEC-BRAID-CBL'), 'Personal Website'::marketplace_enum, 'VT-CBL-100W');

-- ------------------------------------------------------------
-- PRODUCT COST HISTORY
-- (Trigger fn_close_previous_cost_window fires automatically)
-- ------------------------------------------------------------
-- ELEC-WEM-01
INSERT INTO product_cost_history (product_id, sku, valid_from, valid_to, cost_price, notes)
SELECT id, 'ELEC-WEM-01', '2026-01-01', '2026-03-31', 320, 'Initial batch Q1 import contract'
FROM products WHERE sku = 'ELEC-WEM-01';
INSERT INTO product_cost_history (product_id, sku, valid_from, valid_to, cost_price, notes)
SELECT id, 'ELEC-WEM-01', '2026-04-01', '2026-07-31', 350, 'Raw material plastic & chip price adjustment'
FROM products WHERE sku = 'ELEC-WEM-01';
INSERT INTO product_cost_history (product_id, sku, valid_from, cost_price, notes)
SELECT id, 'ELEC-WEM-01', '2026-08-01', 380, 'Current active purchasing cost'
FROM products WHERE sku = 'ELEC-WEM-01';

-- ELEC-USBC-65W
INSERT INTO product_cost_history (product_id, sku, valid_from, valid_to, cost_price, notes)
SELECT id, 'ELEC-USBC-65W', '2026-01-01', '2026-05-31', 390, 'Bulk contract Q1-Q2'
FROM products WHERE sku = 'ELEC-USBC-65W';
INSERT INTO product_cost_history (product_id, sku, valid_from, cost_price, notes)
SELECT id, 'ELEC-USBC-65W', '2026-06-01', 420, 'Semiconductor revision'
FROM products WHERE sku = 'ELEC-USBC-65W';

-- ELEC-ANC-EB
INSERT INTO product_cost_history (product_id, sku, valid_from, valid_to, cost_price, notes)
SELECT id, 'ELEC-ANC-EB', '2026-01-01', '2026-04-30', 780, 'Launch batch pricing'
FROM products WHERE sku = 'ELEC-ANC-EB';
INSERT INTO product_cost_history (product_id, sku, valid_from, cost_price, notes)
SELECT id, 'ELEC-ANC-EB', '2026-05-01', 840, 'Enhanced driver component cost'
FROM products WHERE sku = 'ELEC-ANC-EB';

-- ELEC-BRAID-CBL
INSERT INTO product_cost_history (product_id, sku, valid_from, cost_price, notes)
SELECT id, 'ELEC-BRAID-CBL', '2026-01-01', 110, 'Steady raw material pricing'
FROM products WHERE sku = 'ELEC-BRAID-CBL';

-- ------------------------------------------------------------
-- ORDERS (subset — the full mock data has 16 orders)
-- ------------------------------------------------------------
INSERT INTO orders (display_id, channel_order_id, marketplace, order_date, status,
  customer_name, customer_city, customer_state, shipping_fee_charged,
  marketplace_charges_estimate, settlement_amount, settlement_percent)
VALUES
  ('ORD-0994','OD8839201928410294','Flipkart','2026-08-26','CLAIM_APPROVED',
   'Rakesh Verma','Kanpur','Uttar Pradesh', 40, 160, 0, 0),
  ('ORD-WHL-501','CHALLAN-BLR-882','B2B Wholesale','2026-09-10','CUSTOMER_RETURN',
   'Metro Retail Distribution','Bengaluru','Karnataka', 0, 0, 0, 0),
  ('ORD-0998','402-1829301-4492019','Amazon India','2026-08-18','DELIVERED',
   'Vikram Malhotra','Gurugram','Haryana', 0, 145, NULL, NULL),
  ('ORD-0999','OD8829104910293812','Flipkart','2026-08-25','DELIVERED',
   'Pooja Hegde','Chennai','Tamil Nadu', 40, 210, NULL, NULL),
  ('ORD-1001','402-8392182-1928301','Amazon India','2026-09-02','DELIVERED',
   'Aarav Patel','Bengaluru','Karnataka', 0, 145, NULL, NULL),
  ('ORD-1002','OD3289192839182390','Flipkart','2026-09-03','DELIVERED',
   'Sneha Reddy','Hyderabad','Telangana', 40, 210, NULL, NULL),
  ('ORD-1003','MSH-992104-B','Meesho','2026-09-03','RTO',
   'Rohan Das','Patna','Bihar', 0, 65, NULL, NULL),
  ('ORD-1004','WEB-2026-8819','Personal Website','2026-09-04','DELIVERED',
   'Kavita Nair','Kochi','Kerala', 50, 42, NULL, NULL),
  ('ORD-1005','405-1920394-8291032','Amazon India','2026-09-04','PARTIALLY_RETURNED',
   'Vikram Singhania','Mumbai','Maharashtra', 0, 340, NULL, NULL),
  ('ORD-1006','OD9920193820192841','Flipkart','2026-09-05','SHIPPED',
   'Priya Sharma','Jaipur','Rajasthan', 40, 160, NULL, NULL),
  ('ORD-1007','MSH-110294-A','Meesho','2026-09-05','DELIVERED',
   'Mohd. Tariq','Lucknow','Uttar Pradesh', 0, 38, NULL, NULL),
  ('ORD-1008','MYN-994182901','Myntra','2026-09-06','DELIVERED',
   'Ananya Deshmukh','Pune','Maharashtra', 0, 290, NULL, NULL),
  ('ORD-1009','WC-881920','WooCommerce','2026-09-07','CONFIRMED',
   'Kunal Mehra','Delhi','Delhi', 50, 45, NULL, NULL),
  ('ORD-1010','402-9981240-1928401','Amazon India','2026-09-06','DELIVERED',
   'Divya Kapoor','Delhi','Delhi', 0, 195, NULL, NULL),
  ('ORD-1011','OD7728192019482710','Flipkart','2026-09-06','DELIVERED',
   'Arjun Rampal','Ahmedabad','Gujarat', 40, 290, NULL, NULL),
  ('ORD-1012','MYN-778210928','Myntra','2026-09-05','DELIVERED',
   'Siddharth Verma','Mumbai','Maharashtra', 0, 310, NULL, NULL),
  ('ORD-1013','MYN-882194012','Myntra','2026-09-07','DELIVERED',
   'Kritika Soni','Jaipur','Rajasthan', 0, 185, NULL, NULL),
  ('ORD-1014','MSH-448192-C','Meesho','2026-09-06','DELIVERED',
   'Sunil Verma','Indore','Madhya Pradesh', 0, 42, NULL, NULL),
  ('ORD-1015','MSH-552190-D','Meesho','2026-09-07','DELIVERED',
   'Meenakshi Iyer','Coimbatore','Tamil Nadu', 0, 85, NULL, NULL);

-- ------------------------------------------------------------
-- ORDER ITEMS
-- ------------------------------------------------------------
INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-094', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 0, 198.15, 420, 1
FROM orders o WHERE o.display_id = 'ORD-0994';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-WHL-01', o.id, 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 10, 899, 0, 1370, 380, 10
FROM orders o WHERE o.display_id = 'ORD-WHL-501';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-098', o.id, 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 899, 50, 129.5, 380, 0
FROM orders o WHERE o.display_id = 'ORD-0998';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-099', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 100, 182.9, 420, 0
FROM orders o WHERE o.display_id = 'ORD-0999';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-101', o.id, 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 899, 50, 129.5, 380, 0
FROM orders o WHERE o.display_id = 'ORD-1001';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-102', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 100, 182.9, 420, 0
FROM orders o WHERE o.display_id = 'ORD-1002';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-103', o.id, 'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 2, 299, 0, 45.6, 110, 2
FROM orders o WHERE o.display_id = 'ORD-1003';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-104', o.id, 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 1, 2199, 200, 305, 840, 0
FROM orders o WHERE o.display_id = 'ORD-1004';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-105A', o.id, 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 2, 2199, 100, 650, 840, 1
FROM orders o WHERE o.display_id = 'ORD-1005';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-105B', o.id, 'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 1, 349, 0, 53.2, 110, 0
FROM orders o WHERE o.display_id = 'ORD-1005';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-106', o.id, 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 949, 50, 137, 380, 0
FROM orders o WHERE o.display_id = 'ORD-1006';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-107', o.id, 'ELEC-BRAID-CBL', 'Braided 100W Type-C to Type-C Cable (2m)', 3, 289, 30, 127.8, 110, 0
FROM orders o WHERE o.display_id = 'ORD-1007';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-108', o.id, 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 1, 1999, 150, 281.8, 840, 0
FROM orders o WHERE o.display_id = 'ORD-1008';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-109', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 2, 1199, 0, 365.8, 420, 0
FROM orders o WHERE o.display_id = 'ORD-1009';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-110', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1299, 50, 182.9, 420, 0
FROM orders o WHERE o.display_id = 'ORD-1010';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-111', o.id, 'ELEC-ANC-EB', 'Active Noise Cancelling TWS Earbuds', 1, 2199, 150, 305, 840, 0
FROM orders o WHERE o.display_id = 'ORD-1011';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-112', o.id, 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 2, 999, 100, 279, 380, 0
FROM orders o WHERE o.display_id = 'ORD-1012';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-113', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 1399, 50, 198.5, 420, 0
FROM orders o WHERE o.display_id = 'ORD-1013';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-114', o.id, 'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 1, 799, 20, 114.2, 380, 0
FROM orders o WHERE o.display_id = 'ORD-1014';

INSERT INTO order_items (display_id, order_id, sku, product_name, quantity, selling_price, discount, tax_amount, snapshot_unit_cost, returned_quantity)
SELECT 'ITEM-115', o.id, 'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 2, 1199, 40, 350.2, 420, 0
FROM orders o WHERE o.display_id = 'ORD-1015';

-- ------------------------------------------------------------
-- RETURN RECORDS
-- ------------------------------------------------------------
INSERT INTO return_records (display_id, order_id, channel_order_id, marketplace, return_date, received_date, awb_number, return_type, return_reason, sku, product_name, quantity, condition, restock_status, claim_deadline, return_shipping_cost, customer_return_fee, other_return_costs, inventory_recovery_value, loss_amount, notes)
SELECT 'RET-201', o.id, 'MSH-992104-B', 'Meesho', '2026-09-05', '2026-09-06', 'FMPP0049281920',
  'RTO', 'Customer refused delivery / unreachable address', 'ELEC-BRAID-CBL',
  'Braided 100W Type-C to Type-C Cable (2m)', 2, 'SELLABLE', 'PENDING_RESTOCK',
  '2026-09-12', 0, 0, 0, 220, 0, 'Package returned unopened in original shipper carton.'
FROM orders o WHERE o.display_id = 'ORD-1003';

INSERT INTO return_records (display_id, order_id, channel_order_id, marketplace, return_date, received_date, awb_number, return_type, return_reason, sku, product_name, quantity, condition, restock_status, claim_deadline, return_shipping_cost, customer_return_fee, other_return_costs, inventory_recovery_value, loss_amount, notes)
SELECT 'RET-202', o.id, '405-1920394-8291032', 'Amazon India', '2026-09-06', '2026-09-06', 'AWB-DEL-9921092',
  'DAMAGED_RETURN', 'Customer reported defective right earbud; product housing cracked upon receipt',
  'ELEC-ANC-EB', 'ANC Wireless Earbuds', 1, 'DAMAGED', 'WRITTEN_OFF',
  '2026-10-06', 85, 50, 15, 100, 825, 'Physical damage caused in transit. SAFE-T Claim filed with Amazon.'
FROM orders o WHERE o.display_id = 'ORD-1005';

INSERT INTO return_records (display_id, order_id, channel_order_id, marketplace, return_date, received_date, awb_number, return_type, return_reason, sku, product_name, quantity, condition, restock_status, claim_deadline, return_shipping_cost, customer_return_fee, other_return_costs, inventory_recovery_value, loss_amount, notes)
SELECT 'RET-203', o.id, 'OD8839201928410294', 'Flipkart', '2026-08-28', '2026-08-30', 'EKART-99218201',
  'CUSTOMER_RETURN', 'Wrong item received complaint by customer; awaiting warehouse verification',
  'ELEC-USBC-65W', '65W GaN Fast Charger (Dual USB-C)', 1, 'UNDER_INSPECTION', 'PENDING_RESTOCK',
  '2026-09-11', 65, 40, 10, 0, 495, 'Package sitting in uninspected reverse pallet >18 days.'
FROM orders o WHERE o.display_id = 'ORD-0994';

INSERT INTO return_records (display_id, order_id, channel_order_id, marketplace, return_date, received_date, awb_number, return_type, return_reason, sku, product_name, quantity, condition, restock_status, claim_deadline, return_shipping_cost, customer_return_fee, other_return_costs, inventory_recovery_value, loss_amount, notes)
SELECT 'RET-204', o.id, 'CHALLAN-BLR-882', 'B2B Wholesale', '2026-09-12', '2026-09-14', 'VRL-LOG-77218',
  'CUSTOMER_RETURN', 'Retailer returned overstock cartons prior to quarterly inventory refresh',
  'ELEC-WEM-01', 'Wireless Ergonomic Mouse (Silent Click)', 10, 'SELLABLE', 'PENDING_RESTOCK',
  '2026-10-12', 180, 0, 20, 3800, 200, 'Direct wholesale debit note return. 10 units sealed in original cartons.'
FROM orders o WHERE o.display_id = 'ORD-WHL-501';

-- ------------------------------------------------------------
-- CLAIMS
-- ------------------------------------------------------------
INSERT INTO claims (display_id, order_id, return_id, marketplace, claim_type, claim_date, amount_claimed, amount_recovered, status, recovery_date, notes)
SELECT 'CLM-301', o.id, r.id, 'Amazon India', 'DAMAGED_INVOICE', '2026-09-06', 825, 0, 'FILED', NULL,
  'SAFE-T claim filed for damaged earbuds returned in ORD-1005.'
FROM orders o, return_records r
WHERE o.display_id = 'ORD-1005' AND r.display_id = 'RET-202';

INSERT INTO claims (display_id, order_id, return_id, marketplace, claim_type, claim_date, amount_claimed, amount_recovered, status, recovery_date, notes)
SELECT 'CLM-302', o.id, r.id, 'Flipkart', 'WRONG_RETURN_ITEM', '2026-08-28', 495, 250, 'PARTIALLY_RECOVERED', '2026-09-15',
  'Partial recovery received from Flipkart for wrong return complaint.'
FROM orders o, return_records r
WHERE o.display_id = 'ORD-0994' AND r.display_id = 'RET-203';

-- Back-link claim_id on return_records
UPDATE return_records SET claim_id = (SELECT id FROM claims WHERE display_id = 'CLM-301') WHERE display_id = 'RET-202';
UPDATE return_records SET claim_id = (SELECT id FROM claims WHERE display_id = 'CLM-302') WHERE display_id = 'RET-203';

-- ------------------------------------------------------------
-- SETTLEMENTS
-- ------------------------------------------------------------
INSERT INTO settlements (display_id, settlement_batch_id, marketplace, settlement_date, order_id, gross_amount, tcs_tds_tax, net_settlement, reconciliation_status)
SELECT 'SET-AZ-901', 'AZ-BATCH-SEP-01', 'Amazon India', '2026-09-08', o.id, 899, 13.5, 754, 'RECONCILED'
FROM orders o WHERE o.display_id = 'ORD-0998';

INSERT INTO settlements (display_id, settlement_batch_id, marketplace, settlement_date, order_id, gross_amount, tcs_tds_tax, net_settlement, reconciliation_status)
SELECT 'SET-FK-401', 'FK-BATCH-SEP-01', 'Flipkart', '2026-09-09', o.id, 1299, 19.5, 1070, 'RECONCILED'
FROM orders o WHERE o.display_id = 'ORD-0999';

INSERT INTO settlements (display_id, settlement_batch_id, marketplace, settlement_date, order_id, gross_amount, tcs_tds_tax, net_settlement, reconciliation_status)
SELECT 'SET-WEB-101', 'WEB-BATCH-SEP-01', 'Personal Website', '2026-09-05', o.id, 2199, 0, 2157, 'RECONCILED'
FROM orders o WHERE o.display_id = 'ORD-1004';

INSERT INTO settlements (display_id, settlement_batch_id, marketplace, settlement_date, order_id, gross_amount, tcs_tds_tax, net_settlement, reconciliation_status)
SELECT 'SET-MSH-001', 'MSH-BATCH-SEP-01', 'Meesho', '2026-09-08', o.id, 867, 13, 816, 'RECONCILED'
FROM orders o WHERE o.display_id = 'ORD-1007';

-- ------------------------------------------------------------
-- PURCHASE BILLS
-- ------------------------------------------------------------
INSERT INTO purchase_bills (display_id, supplier_id, supplier_name, invoice_number, invoice_date, sku, quantity, unit_cost, taxes, total_amount, payment_status)
VALUES
  ('PUR-1001',
   (SELECT id FROM suppliers WHERE display_id = 'SUP-001'),
   'Apex Electronics Mfg Ltd', 'APEX-INV-2026-001', '2026-01-15',
   'ELEC-WEM-01', 120, 320, 6912, 45312, 'PAID'),
  ('PUR-1002',
   (SELECT id FROM suppliers WHERE display_id = 'SUP-002'),
   'Zenith Cable & Power Supplies', 'ZEN-INV-2026-001', '2026-01-20',
   'ELEC-USBC-65W', 80, 390, 4992, 36192, 'PAID'),
  ('PUR-1003',
   (SELECT id FROM suppliers WHERE display_id = 'SUP-001'),
   'Apex Electronics Mfg Ltd', 'APEX-INV-2026-002', '2026-08-01',
   'ELEC-WEM-01', 100, 380, 6840, 44840, 'PAID'),
  ('PUR-1004',
   (SELECT id FROM suppliers WHERE display_id = 'SUP-002'),
   'Zenith Cable & Power Supplies', 'ZEN-INV-2026-002', '2026-06-01',
   'ELEC-USBC-65W', 60, 420, 4536, 29736, 'PENDING');

-- ------------------------------------------------------------
-- EXPENSES
-- ------------------------------------------------------------
INSERT INTO expenses (display_id, expense_date, category, description, amount, vendor, payment_method, is_recurring, marketplace, attributed_sku)
VALUES
  ('EXP-001', '2026-09-01', 'Advertising', 'Amazon Sponsored Products — August Campaign', 8200, 'Amazon Ads', 'BANK_TRANSFER', TRUE, 'Amazon India', NULL),
  ('EXP-002', '2026-09-01', 'Advertising', 'Flipkart PLA Ads — TWS Earbuds Boost', 3500, 'Flipkart Ads', 'BANK_TRANSFER', FALSE, 'Flipkart', 'ELEC-ANC-EB'),
  ('EXP-003', '2026-09-01', 'Salaries', 'Warehouse Staff — September Payroll', 45000, 'Internal Payroll', 'BANK_TRANSFER', TRUE, NULL, NULL),
  ('EXP-004', '2026-09-01', 'Software', 'Shiprocket Subscription — Monthly', 2999, 'Shiprocket', 'CREDIT_CARD', TRUE, NULL, NULL),
  ('EXP-005', '2026-09-01', 'Packaging', 'Corrugated Boxes & Bubble Wrap — Bulk Order', 5400, 'PackPro Supplies', 'UPI', FALSE, NULL, NULL),
  ('EXP-006', '2026-09-01', 'Rent', 'Warehouse Rent — Bhiwandi Facility (Sep 2026)', 22000, 'Bhiwandi Logistics Park', 'BANK_TRANSFER', TRUE, NULL, NULL);

-- ------------------------------------------------------------
-- CUSTOMER COMPLAINTS
-- ------------------------------------------------------------
INSERT INTO customer_complaints (display_id, ticket_number, customer_name, customer_email, order_id, channel_order_id, marketplace, sku, category, priority, status, subject, description)
SELECT 'TKT-1001', 'TKT-1001', 'Rakesh Verma', 'rakesh.verma@gmail.com',
  o.id, 'OD8839201928410294', 'Flipkart', 'ELEC-USBC-65W',
  'WRONG_ITEM_RECEIVED', 'HIGH', 'IN_PROGRESS',
  'Wrong item received in my order',
  'I ordered a 65W GaN charger but received a different product. Please resolve ASAP.'
FROM orders o WHERE o.display_id = 'ORD-0994';
