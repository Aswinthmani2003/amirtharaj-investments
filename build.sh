#!/bin/bash
cat > assets/js/env.js << EOF
window.__ENV__ = {
  SUPABASE_URL:  "$SUPABASE_URL",
  SUPABASE_ANON: "$SUPABASE_ANON"
};
EOF
echo "✅ env.js generated"
pip install -r requirements.txt
