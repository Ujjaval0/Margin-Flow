BEGIN;

-- No registration or price basis is inferred for existing tenants or imported orders.
CREATE TABLE IF NOT EXISTS channel_accounting_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  marketplace text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  prices_include_tax boolean,
  gst_registration_type text CHECK (gst_registration_type IN ('REGULAR', 'COMPOSITION', 'UNREGISTERED')),
  marketplace_fees_include_gst boolean,
  logistics_rate_slabs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(logistics_rate_slabs) = 'array'),
  marketplace_fee_gst_rate_bps integer NOT NULL DEFAULT 1800 CHECK (marketplace_fee_gst_rate_bps BETWEEN 0 AND 10000),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  UNIQUE (user_id, marketplace, effective_from)
);
ALTER TABLE channel_accounting_policies ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON channel_accounting_policies FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON channel_accounting_policies FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON channel_accounting_policies FROM authenticated';
  END IF;
END;
$$;

CREATE TABLE statutory_withholding_rates (
  user_id uuid NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  tcs_bps integer NOT NULL CHECK (tcs_bps BETWEEN 0 AND 10000),
  tds_bps integer NOT NULL CHECK (tds_bps BETWEEN 0 AND 10000),
  PRIMARY KEY (user_id, effective_from)
);
ALTER TABLE statutory_withholding_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON statutory_withholding_rates FROM PUBLIC, anon, authenticated;

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_subtotal numeric(15,2) CHECK (line_subtotal >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_grams numeric CHECK (weight_grams > 0);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS tcs_tax numeric(15,2);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS tds_tax numeric(15,2);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS tcs_taxable_value numeric(15,2);
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS tds_gross_amount numeric(15,2);
ALTER TABLE settlement_deductions ADD COLUMN IF NOT EXISTS gst_amount numeric(15,2);

COMMIT;
