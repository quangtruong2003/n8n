-- Migration 002: Add stock_quantity to Product table
-- For inventory tracking on physical products (type = 'product')

ALTER TABLE Product ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;
