#!/bin/bash
# Generate the missing E-com.casa editorial product images (one-shot asset run)
# Consistent style: warm neutral editorial, cream palette, natural daylight, premium European home brand
set -u
cd /home/z/my-project/public/images
STYLE="professional ecommerce product photography, warm neutral editorial style, cream and beige palette, soft natural daylight, premium European home and garden brand aesthetic, minimalist styled scene, high quality, detailed"

gen() {
  local key="$1"; shift
  local prompt="$1"
  if [ -f "product-${key}.jpg" ]; then echo "skip product-${key}.jpg"; return; fi
  echo "generating product-${key}.jpg ..."
  z-ai image -p "${prompt}, ${STYLE}" -o "product-${key}.png" -s 1024x1024 > /dev/null 2>&1 \
    && mv "product-${key}.png" "product-${key}.jpg" \
    && echo "  ok" || echo "  FAILED product-${key}"
}

gen "ceramic-table-lamp" "hand-glazed warm cream ceramic table lamp with a natural linen drum shade, glowing softly on a wooden bedside table"
gen "floor-lamp" "tall solid oak floor lamp with a round soft paper lantern shade, warm glow, in a calm japandi living room corner"
gen "outdoor-wall-light" "matte black modern outdoor wall sconce light mounted on a white rendered house wall at dusk, warm light pool below"
gen "led-light-strip" "warm white LED strip light glowing softly under a floating oak kitchen shelf, close up detail, cosy evening kitchen"
gen "smart-lamp" "slim minimalist smart ambient LED light bar glowing warm behind a television in a modern neutral living room, subtle gradient light"
gen "wall-art" "pair of framed abstract art prints with earthy terracotta and sand tones in thin oak frames on a cream wall above an oak console table"
gen "candle-set" "three handmade ceramic candle holders in sage green sand and clay tones with lit dinner candles, stepped heights on a table"
gen "decorative-tray" "solid oak styling tray with raised edge holding a small candle, keys and a ceramic bowl, styled on a coffee table"
gen "herb-pots" "three classic terracotta plant pots with fresh basil thyme and rosemary herbs on a bright kitchen windowsill"
gen "raised-planter" "compact cedar wood raised garden bed planter box with lettuce and herbs on a modern patio"
gen "privacy-screen" "horizontal wooden slatted privacy screen in warm oak standing on a modern balcony with potted grasses, soft morning light"
gen "bistro-set" "small round steel bistro table with two matching green chairs on a charming city balcony with morning coffee"
gen "parasol" "elegant cream colored round garden parasol tilted over a terrace dining table with linen chairs, sunny mediterranean patio"
gen "serving-board" "long acacia wood serving board with a leather hanging loop styled with cheese grapes and bread on a table"
gen "dining-bowls" "stack of sand colored reactive glaze stoneware bowls and dinner plates, artisanal ceramic tableware set, warm kitchen light"
gen "storage-jars" "three clear glass storage jars with bamboo lids filled with pasta oats and coffee beans on a wooden kitchen shelf"
gen "doormat" "natural coir doormat with an oak brown border at the entrance of a beautiful home doorway with plants either side"
echo "DONE"
