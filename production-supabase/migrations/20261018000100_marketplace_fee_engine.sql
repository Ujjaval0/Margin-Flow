-- Marketplace fee rules and estimate snapshots.
-- Apply after 20261017000100_initial_schema.sql and 20261017000200_production_data_fidelity.sql.
-- Additive only: legacy order amounts and settlement deductions remain intact.
-- Percentage precision is one basis point (0.01%); amounts are integer paise;
-- percentage components round half up individually. Price bands are [min, max).
-- Rollback: revert application code and retain these additive objects so fee snapshots
-- and audit rows are not destroyed; any later removal requires a reviewed data export.

BEGIN;

ALTER TYPE audit_entity_type_enum ADD VALUE IF NOT EXISTS 'FEE_RULE';

ALTER TABLE orders
  ADD COLUMN fulfilment_mode TEXT,
  ADD COLUMN quick_fee_rate_bps INTEGER CHECK (quick_fee_rate_bps IS NULL OR quick_fee_rate_bps BETWEEN 0 AND 10000),
  ADD COLUMN fee_estimate_status TEXT NOT NULL DEFAULT 'LEGACY'
    CHECK (fee_estimate_status IN ('CONFIGURED', 'NOT_CONFIGURED', 'LEGACY'));

COMMENT ON COLUMN orders.quick_fee_rate_bps IS
  'Per-order temporary commission override in basis points; applies to discounted item value excluding item tax and never changes permanent marketplace fee rules.';

CREATE UNIQUE INDEX uq_orders_owner_id ON orders (user_id, id);

CREATE TABLE marketplace_fee_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  marketplace marketplace_enum NOT NULL,
  sku TEXT,
  product_category TEXT,
  fulfilment_mode TEXT,
  min_unit_price_paise BIGINT CHECK (min_unit_price_paise IS NULL OR min_unit_price_paise >= 0),
  max_unit_price_paise BIGINT CHECK (max_unit_price_paise IS NULL OR max_unit_price_paise >= 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  rule_group_id UUID NOT NULL DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'ARCHIVED', 'SUPERSEDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_fee_rules_price_range CHECK (
    min_unit_price_paise IS NULL OR max_unit_price_paise IS NULL OR min_unit_price_paise < max_unit_price_paise
  ),
  CONSTRAINT marketplace_fee_rules_date_range CHECK (effective_to IS NULL OR effective_from <= effective_to),
  CONSTRAINT marketplace_fee_rules_scope_values CHECK (
    (sku IS NULL OR length(btrim(sku)) > 0) AND (product_category IS NULL OR length(btrim(product_category)) > 0)
    AND (fulfilment_mode IS NULL OR length(btrim(fulfilment_mode)) > 0)
  ),
  CONSTRAINT marketplace_fee_rules_owner_id UNIQUE (user_id, id),
  CONSTRAINT marketplace_fee_rules_version_unique UNIQUE (user_id, rule_group_id, version)
);

CREATE TABLE marketplace_fee_rule_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES marketplace_fee_rules(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  component_type TEXT NOT NULL CHECK (length(component_type) BETWEEN 1 AND 60),
  calculation_method TEXT NOT NULL CHECK (calculation_method IN ('PERCENT', 'FIXED_ORDER', 'PER_UNIT')),
  rate_bps INTEGER,
  amount_paise BIGINT,
  calculation_base TEXT,
  tax_treatment TEXT NOT NULL CHECK (tax_treatment IN ('NO_TAX', 'TAXABLE', 'TAX_INCLUDED')),
  tax_rate_bps INTEGER,
  sequence INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_fee_component_value CHECK (
    (calculation_method = 'PERCENT' AND rate_bps IS NOT NULL AND rate_bps BETWEEN 0 AND 10000 AND amount_paise IS NULL
      AND calculation_base IS NOT NULL AND calculation_base IN ('ITEM_BEFORE_DISCOUNT', 'ITEM_AFTER_DISCOUNT', 'ITEM_EXCLUDING_TAX'))
    OR (calculation_method IN ('FIXED_ORDER', 'PER_UNIT') AND amount_paise IS NOT NULL AND amount_paise >= 0 AND rate_bps IS NULL AND calculation_base IS NULL)
  ),
  CONSTRAINT marketplace_fee_component_tax CHECK (
    (tax_treatment = 'TAXABLE' AND tax_rate_bps IS NOT NULL AND tax_rate_bps BETWEEN 0 AND 10000)
    OR (tax_treatment IN ('NO_TAX', 'TAX_INCLUDED') AND tax_rate_bps IS NULL)
  ),
  CONSTRAINT marketplace_fee_component_owner_rule UNIQUE (user_id, id, rule_id),
  CONSTRAINT marketplace_fee_component_rule_owner_fk FOREIGN KEY (user_id, rule_id)
    REFERENCES marketplace_fee_rules(user_id, id) ON DELETE CASCADE
);

CREATE TABLE order_fee_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  order_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('CONFIGURED', 'NOT_CONFIGURED', 'LEGACY')),
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  total_paise BIGINT CHECK (total_paise IS NULL OR total_paise >= 0),
  calculation_version INTEGER NOT NULL DEFAULT 1 CHECK (calculation_version > 0),
  input_snapshot JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT order_fee_estimate_status_total CHECK ((status = 'CONFIGURED' AND total_paise IS NOT NULL) OR (status <> 'CONFIGURED' AND total_paise IS NULL)),
  CONSTRAINT order_fee_estimate_owner_order_fk FOREIGN KEY (user_id, order_id)
    REFERENCES orders(user_id, id) ON DELETE CASCADE,
  CONSTRAINT order_fee_estimates_owner_id UNIQUE (user_id, id)
);

ALTER TABLE order_fee_estimates ALTER COLUMN calculated_at SET DEFAULT clock_timestamp();

CREATE TABLE marketplace_quick_fee_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  marketplace marketplace_enum NOT NULL,
  rate_bps INTEGER NOT NULL CHECK (rate_bps BETWEEN 0 AND 10000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_quick_fee_rate_unique UNIQUE (user_id, marketplace, rate_bps)
);
CREATE INDEX marketplace_quick_fee_rates_owner_lookup_idx
  ON marketplace_quick_fee_rates (user_id, marketplace, created_at, rate_bps);

INSERT INTO marketplace_quick_fee_rates (user_id, marketplace, rate_bps)
SELECT account.id, channel.marketplace, rate.rate_bps
FROM user_accounts account
CROSS JOIN unnest(enum_range(NULL::marketplace_enum)) AS channel(marketplace)
CROSS JOIN unnest(ARRAY[500, 700, 1000, 1500, 2000, 3000]) AS rate(rate_bps)
ON CONFLICT (user_id, marketplace, rate_bps) DO NOTHING;

CREATE OR REPLACE FUNCTION seed_marketplace_quick_fee_rates_for_account()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO marketplace_quick_fee_rates (user_id, marketplace, rate_bps)
  SELECT NEW.id, channel.marketplace, rate.rate_bps
  FROM unnest(enum_range(NULL::marketplace_enum)) AS channel(marketplace)
  CROSS JOIN unnest(ARRAY[500, 700, 1000, 1500, 2000, 3000]) AS rate(rate_bps)
  ON CONFLICT (user_id, marketplace, rate_bps) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_seed_marketplace_quick_fee_rates
  AFTER INSERT ON user_accounts
  FOR EACH ROW EXECUTE FUNCTION seed_marketplace_quick_fee_rates_for_account();

CREATE TABLE order_fee_estimate_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL,
  rule_id UUID,
  rule_version INTEGER,
  rule_component_id UUID,
  line_sku TEXT NOT NULL,
  component_name TEXT NOT NULL,
  component_type TEXT NOT NULL,
  calculation_method TEXT NOT NULL CHECK (calculation_method IN ('PERCENT', 'FIXED_ORDER', 'PER_UNIT')),
  calculation_base_paise BIGINT NOT NULL CHECK (calculation_base_paise >= 0),
  rate_bps INTEGER,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  tax_treatment TEXT NOT NULL CHECK (tax_treatment IN ('NO_TAX', 'TAXABLE', 'TAX_INCLUDED')),
  tax_rate_bps INTEGER NOT NULL CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  tax_paise BIGINT NOT NULL CHECK (tax_paise >= 0),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  sequence INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT order_fee_estimate_component_owner_fk FOREIGN KEY (user_id, estimate_id)
    REFERENCES order_fee_estimates(user_id, id) ON DELETE CASCADE,
  CONSTRAINT order_fee_estimate_component_rule_fk FOREIGN KEY (user_id, rule_component_id, rule_id)
    REFERENCES marketplace_fee_rule_components(user_id, id, rule_id)
);

CREATE INDEX marketplace_fee_rules_owner_lookup_idx
  ON marketplace_fee_rules (user_id, marketplace, status, effective_from, effective_to);
CREATE INDEX marketplace_fee_rules_owner_scope_idx
  ON marketplace_fee_rules (user_id, marketplace, sku, product_category, fulfilment_mode);
CREATE INDEX order_fee_estimates_order_time_idx
  ON order_fee_estimates (user_id, order_id, calculated_at DESC);
CREATE INDEX order_fee_estimate_components_estimate_idx
  ON order_fee_estimate_components (user_id, estimate_id, sequence);

CREATE OR REPLACE FUNCTION reject_ambiguous_marketplace_fee_rule()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  new_specificity INTEGER;
BEGIN
  IF NEW.status <> 'ACTIVE' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::TEXT || ':' || NEW.marketplace::TEXT, 0));
  new_specificity := (NEW.sku IS NOT NULL)::INTEGER + (NEW.product_category IS NOT NULL)::INTEGER +
    (NEW.fulfilment_mode IS NOT NULL)::INTEGER +
    (NEW.min_unit_price_paise IS NOT NULL OR NEW.max_unit_price_paise IS NOT NULL)::INTEGER;
  IF EXISTS (
    SELECT 1 FROM marketplace_fee_rules existing
    WHERE existing.user_id = NEW.user_id AND existing.marketplace = NEW.marketplace
      AND existing.status = 'ACTIVE' AND existing.id <> NEW.id
      AND (existing.sku IS NULL OR NEW.sku IS NULL OR existing.sku = NEW.sku)
      AND (existing.product_category IS NULL OR NEW.product_category IS NULL OR existing.product_category = NEW.product_category)
      AND (existing.fulfilment_mode IS NULL OR NEW.fulfilment_mode IS NULL OR existing.fulfilment_mode = NEW.fulfilment_mode)
      AND COALESCE(existing.min_unit_price_paise, 0) < COALESCE(NEW.max_unit_price_paise, 9223372036854775807)
      AND COALESCE(NEW.min_unit_price_paise, 0) < COALESCE(existing.max_unit_price_paise, 9223372036854775807)
      AND existing.effective_from <= COALESCE(NEW.effective_to, 'infinity'::DATE)
      AND NEW.effective_from <= COALESCE(existing.effective_to, 'infinity'::DATE)
      AND ((existing.sku IS NOT NULL)::INTEGER + (existing.product_category IS NOT NULL)::INTEGER +
        (existing.fulfilment_mode IS NOT NULL)::INTEGER +
        (existing.min_unit_price_paise IS NOT NULL OR existing.max_unit_price_paise IS NOT NULL)::INTEGER) = new_specificity
  ) THEN
    RAISE EXCEPTION 'An equally specific active fee rule overlaps this scope and effective period.' USING ERRCODE = '23P01';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_fee_rule_no_ambiguous_overlap
  BEFORE INSERT OR UPDATE OF marketplace, sku, product_category, fulfilment_mode, min_unit_price_paise,
    max_unit_price_paise, effective_from, effective_to, status ON marketplace_fee_rules
  FOR EACH ROW EXECUTE FUNCTION reject_ambiguous_marketplace_fee_rule();

CREATE OR REPLACE FUNCTION reject_order_fee_snapshot_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Order fee estimate snapshots are append-only.';
END;
$$;

CREATE TRIGGER trg_order_fee_estimates_immutable
  BEFORE UPDATE OR DELETE ON order_fee_estimates
  FOR EACH ROW EXECUTE FUNCTION reject_order_fee_snapshot_mutation();
CREATE TRIGGER trg_order_fee_estimate_components_immutable
  BEFORE UPDATE OR DELETE ON order_fee_estimate_components
  FOR EACH ROW EXECUTE FUNCTION reject_order_fee_snapshot_mutation();

ALTER TABLE marketplace_fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_fee_rule_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_fee_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_fee_estimate_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_quick_fee_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON marketplace_fee_rules, marketplace_fee_rule_components, order_fee_estimates, order_fee_estimate_components, marketplace_quick_fee_rates FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON marketplace_fee_rules, marketplace_fee_rule_components, order_fee_estimates, order_fee_estimate_components, marketplace_quick_fee_rates FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON marketplace_fee_rules, marketplace_fee_rule_components, order_fee_estimates, order_fee_estimate_components, marketplace_quick_fee_rates FROM authenticated';
  END IF;
END;
$$;

COMMIT;
