#!/usr/bin/env bash
# ============================================================
# TWA (Trusted Web Activity) Build Helper for Ledo Game
# ============================================================
#
# Prerequisites:
#   1. Your site is deployed on HTTPS (e.g. https://ledo-game.com)
#   2. manifest.json is accessible at https://your-domain/manifest.json
#   3. Icons (icon-192.png, icon-512.png) are in public/icons/
#   4. Node.js & npm are installed
#   5. Android Studio is installed (with Android SDK)
#   6. Java JDK is installed (for keytool)
#
# Usage:
#   chmod +x scripts/build-twa.sh
#   ./scripts/build-twa.sh
# ============================================================

set -e

SITE_URL="${SITE_URL:-https://your-domain.com}"  # <-- CHANGE THIS

echo ""
echo "=========================================="
echo "  Ledo Game - TWA Builder"
echo "=========================================="
echo ""
echo "Target site: $SITE_URL"
echo ""

# -----------------------------------------------------------
# Step 1: Check if bubblewrap is installed
# -----------------------------------------------------------
if ! command -v bubblewrap &> /dev/null; then
  echo "[1/5] Installing @bubblewrap/cli globally..."
  npm install -g @bubblewrap/cli
else
  echo "[1/5] @bubblewrap/cli already installed."
fi

# -----------------------------------------------------------
# Step 2: Create a working directory for the TWA project
# -----------------------------------------------------------
TWA_DIR="$(pwd)/twa-output"
mkdir -p "$TWA_DIR"
echo "[2/5] TWA project directory: $TWA_DIR"

# -----------------------------------------------------------
# Step 3: Generate signing key (if it doesn't exist)
# -----------------------------------------------------------
KEYSTORE="$TWA_DIR/release-key.jks"
if [ ! -f "$KEYSTORE" ]; then
  echo "[3/5] Generating release signing key..."
  echo "      (You'll be prompted for a password and details)"
  keytool -genkey -v \
    -keystore "$KEYSTORE" \
    -alias ledo-key \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000
else
  echo "[3/5] Release keystore already exists at $KEYSTORE"
fi

# -----------------------------------------------------------
# Step 4: Print the SHA-256 fingerprint (needed for assetlinks.json)
# -----------------------------------------------------------
echo ""
echo "[4/5] SHA-256 fingerprint of your signing key:"
echo "      (Copy this into .well-known/assetlinks.json on your server)"
echo ""
keytool -list -v -keystore "$KEYSTORE" -alias ledo-key 2>/dev/null | grep "SHA256:" || \
keytool -list -v -keystore "$KEYSTORE" -alias ledo-key | grep "SHA-256:"
echo ""

# -----------------------------------------------------------
# Step 5: Initialize Bubblewrap TWA project
# -----------------------------------------------------------
echo "[5/5] Initializing Bubblewrap TWA project..."
echo "      Manifest URL: $SITE_URL/manifest.json"
echo ""
cd "$TWA_DIR"
bubblewrap init --manifest="$SITE_URL/manifest.json"

echo ""
echo "=========================================="
echo "  TWA project created in: $TWA_DIR"
echo ""
echo "  Next steps:"
echo "    cd $TWA_DIR"
echo "    bubblewrap build"
echo ""
echo "  Then install on device:"
echo "    adb install -r app-release-signed.apk"
echo "=========================================="
