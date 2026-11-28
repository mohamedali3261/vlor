-- Variants are additive: product URLs and the original image remain unchanged.
CREATE TABLE IF NOT EXISTS image_variants (
  image_key TEXT NOT NULL REFERENCES images(key) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK(variant IN ('small-v1','large-v1')),
  content_type TEXT NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
  data_base64 TEXT NOT NULL CHECK(length(data_base64) BETWEEN 16 AND 466668),
  size INTEGER NOT NULL CHECK(size BETWEEN 12 AND 350000),
  PRIMARY KEY(image_key,variant)
);
