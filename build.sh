#!/bin/bash
# Install setuptools first to fix pkg_resources issue
pip install --upgrade pip setuptools wheel

cat > assets/js/env.js << EOF
window.__ENV__ = {
  SUPABASE_URL:  "$SUPABASE_URL",
  SUPABASE_ANON: "$SUPABASE_ANON"
};
EOF
echo "✅ env.js generated"
pip install -r requirements.txt
