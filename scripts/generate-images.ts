import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/home/z/my-project/public/images';

type Job = { file: string; size: string; prompt: string };

const STYLE = 'warm editorial interior photography, European home and garden aesthetic, natural materials, oak wood, linen, cream and olive tones, soft natural light, photorealistic, premium magazine quality, no text, no watermark';

const jobs: Job[] = [
  // ---------- HERO ----------
  {
    file: 'hero.jpg', size: '1344x768',
    prompt: `Luxurious modern Mediterranean terrace at golden dusk, L-shaped outdoor sectional sofa with beige and olive cushions, natural wood coffee table, glowing lanterns and candles, potted olive trees and plants, stone wall, sea view on horizon, warm evening light, cinematic wide shot, ${STYLE}`,
  },
  // ---------- SHOP BY SPACE ----------
  {
    file: 'space-living-room.jpg', size: '1152x864',
    prompt: `Warm minimalist living room, beige linen sofa, round wooden coffee table, oak wood slat wall panel, large windows with sheer curtains, plants, neutral cream palette, ${STYLE}`,
  },
  {
    file: 'space-bedroom.jpg', size: '1152x864',
    prompt: `Serene bedroom with natural wood bed frame, ivory bedding, linen throw in warm caramel, bedside pendant lamps, soft morning light, minimal styling, plants, ${STYLE}`,
  },
  {
    file: 'space-kitchen.jpg', size: '1152x864',
    prompt: `Modern European kitchen with matte sage green cabinets, wooden countertop, open shelving with ceramics, bar stools at island, warm lighting, ${STYLE}`,
  },
  {
    file: 'space-bathroom.jpg', size: '1152x864',
    prompt: `Spa-like bathroom, natural stone sink, round mirror, wooden vanity, beige microcement walls, eucalyptus branches, soft daylight, ${STYLE}`,
  },
  {
    file: 'space-garden.jpg', size: '1152x864',
    prompt: `Lush modern European garden with stone path, raised planters with olive trees and lavender, wooden privacy slats, outdoor lanterns, evening golden light, ${STYLE}`,
  },
  {
    file: 'space-balcony.jpg', size: '1152x864',
    prompt: `Cozy small urban balcony, wooden deck tiles, rattan bistro chair, many potted plants and flowers, string lights, morning coffee cup on table, ${STYLE}`,
  },
  {
    file: 'space-home-office.jpg', size: '1152x864',
    prompt: `Elegant home office, oak desk, designer chair, shelf with books and ceramics, large window with garden view, warm daylight, laptop closed, minimal, ${STYLE}`,
  },
  // ---------- SHOP BY STYLE (circles) ----------
  {
    file: 'style-warm-minimal.jpg', size: '1024x1024',
    prompt: `Warm minimal interior corner, cream boucle armchair, oak side table, ceramic vase with dried grass, white wall, soft shadows, ${STYLE}`,
  },
  {
    file: 'style-natural.jpg', size: '1024x1024',
    prompt: `Natural style interior, rattan armchair with linen cushion, jute rug, wooden stool, abundant daylight, raw textures, ${STYLE}`,
  },
  {
    file: 'style-modern.jpg', size: '1024x1024',
    prompt: `Modern contemporary living room corner, charcoal sofa, sculptural black floor lamp, marble side table, abstract art, clean lines, ${STYLE}`,
  },
  {
    file: 'style-japandi.jpg', size: '1024x1024',
    prompt: `Japandi style interior, low wooden platform bed bench, paper lantern, bonsai plant, rice paper screen, wabi-sabi calm, muted earth tones, ${STYLE}`,
  },
  {
    file: 'style-organic.jpg', size: '1024x1024',
    prompt: `Organic modern corner, curved cream sofa, live-edge wood coffee table, large monstera and olive plants, stone floor, organic shapes, ${STYLE}`,
  },
  {
    file: 'style-neo-deco.jpg', size: '1024x1024',
    prompt: `Neo deco interior detail, velvet emerald chair, brass and glass side table, arched mirror, fluted wood panel wall, luxurious, ${STYLE}`,
  },
  {
    file: 'style-mediterranean.jpg', size: '1024x1024',
    prompt: `Mediterranean terrace corner, whitewashed wall, terracotta pots with olive tree and bougainvillea, rattan chair, sea light, ${STYLE}`,
  },
  // ---------- COLLECTIONS ----------
  {
    file: 'collection-wall-makeover.jpg', size: '1152x864',
    prompt: `Living room wall with vertical oak wood slat panels behind TV, warm ambient lighting, plant on media console, evening cozy mood, ${STYLE}`,
  },
  {
    file: 'collection-mood-lighting.jpg', size: '1152x864',
    prompt: `Corner of a living room at dusk with warm glowing table lamps, LED candle lanterns, plant silhouettes, cozy intimate lighting atmosphere, ${STYLE}`,
  },
  {
    file: 'collection-garden-glow.jpg', size: '1152x864',
    prompt: `Modern garden at night with glowing solar lanterns along stone path, illuminated planters with grasses, warm garden lighting magic, blue hour, ${STYLE}`,
  },
  {
    file: 'collection-balcony-escape.jpg', size: '1152x864',
    prompt: `Small balcony transformed into green oasis at sunset, folding chair, lanterns, lush planters, string lights, outdoor cushions, ${STYLE}`,
  },
  // ---------- PRODUCTS ----------
  {
    file: 'product-wood-slat-panel.jpg', size: '1024x1024',
    prompt: `Product photography of oak wood slat wall panel sample, vertical wooden slats, natural oak finish, mounted on wall section, studio quality, ${STYLE}`,
  },
  {
    file: 'product-led-table-lamp.jpg', size: '1024x1024',
    prompt: `Product photography of portable rechargeable LED table lamp, mushroom shape, matte cream finish, glowing warm light, on wooden table, styled interior background softly blurred, ${STYLE}`,
  },
  {
    file: 'product-arched-mirror.jpg', size: '1024x1024',
    prompt: `Product photography of elegant arched wall mirror with thin brass frame, leaning against warm beige plaster wall, styled with plant branch in vase, ${STYLE}`,
  },
  {
    file: 'product-ceramic-planter.jpg', size: '1024x1024',
    prompt: `Product photography of set of two ribbed ceramic planters in cream white, one larger one smaller, green plants inside, on stone surface, minimal background, ${STYLE}`,
  },
  {
    file: 'product-solar-lantern.jpg', size: '1024x1024',
    prompt: `Product photography of set of two black metal solar garden lanterns with warm glowing LED candles, on outdoor stone table at dusk, plants around, ${STYLE}`,
  },
  {
    file: 'product-outdoor-sofa.jpg', size: '1024x1024',
    prompt: `Product photography of modern outdoor sofa set, natural acacia wood frame with beige weather-resistant cushions, on terrace with plants, evening light, ${STYLE}`,
  },
  {
    file: 'product-rattan-chair.jpg', size: '1024x1024',
    prompt: `Product photography of sculptural rattan accent chair with curved back, natural tone, in styled interior corner with plant and linen curtain, ${STYLE}`,
  },
  {
    file: 'product-linen-cushions.jpg', size: '1024x1024',
    prompt: `Product photography of set of three linen cushion covers in olive, caramel and cream tones arranged on a sofa, textured fabric detail, ${STYLE}`,
  },
  {
    file: 'product-oak-wall-shelf.jpg', size: '1024x1024',
    prompt: `Product photography of minimal oak wood wall shelf with books, small ceramic vase and trailing plant, on warm white wall, ${STYLE}`,
  },
  {
    file: 'product-pendant-lamp.jpg', size: '1024x1024',
    prompt: `Product photography of woven rattan pendant lamp hanging, warm glowing bulb inside, boho elegant, against soft neutral wall background, ${STYLE}`,
  },
  {
    file: 'product-garden-torch.jpg', size: '1024x1024',
    prompt: `Product photography of modern garden flame torch in black steel with wooden pole, glowing flame at dusk in garden with grasses, ${STYLE}`,
  },
  {
    file: 'product-seagrass-basket.jpg', size: '1024x1024',
    prompt: `Product photography of set of two seagrass storage baskets with handles, natural woven texture, one with rolled blankets, beside sofa, ${STYLE}`,
  },
  {
    file: 'product-teak-bench.jpg', size: '1024x1024',
    prompt: `Product photography of solid teak wood entryway bench with slatted top and lower shelf, styled with linen cushion and basket, hallway, ${STYLE}`,
  },
  {
    file: 'product-ceramic-vase-set.jpg', size: '1024x1024',
    prompt: `Product photography of set of three matte ceramic vases in terracotta, sand and off-white, with dried pampas grass, on oak table, ${STYLE}`,
  },
  {
    file: 'product-palm-planter.jpg', size: '1024x1024',
    prompt: `Product photography of tall architectural fiberstone planter in warm grey with kentia palm, modern indoor styling next to sofa, ${STYLE}`,
  },
  {
    file: 'product-string-lights.jpg', size: '1024x1024',
    prompt: `Product photography of solar string lights with warm glowing bulbs draped over balcony railing with plants at dusk, cozy outdoor ambiance, ${STYLE}`,
  },
  {
    file: 'product-wall-clock.jpg', size: '1024x1024',
    prompt: `Product photography of large minimal wooden wall clock in oak, clean numerals, on warm white wall above sideboard, ${STYLE}`,
  },
  {
    file: 'product-fire-pit.jpg', size: '1024x1024',
    prompt: `Product photography of round outdoor fire pit table in dark grey fiberstone with visible flames, on terrace with outdoor chairs at dusk, ${STYLE}`,
  },
  // ---------- JOURNAL ----------
  {
    file: 'journal-wall-transform.jpg', size: '1344x768',
    prompt: `DIY installation of oak wood slat wall panels, hands with drill mounting panel, half-finished wall transformation, bright room, editorial, ${STYLE}`,
  },
  {
    file: 'journal-balcony-ideas.jpg', size: '1344x768',
    prompt: `Small balcony makeover with planters, folding furniture and string lights, evening, editorial story image, ${STYLE}`,
  },
  {
    file: 'journal-garden-lighting.jpg', size: '1344x768',
    prompt: `Garden at blue hour with layered warm lighting, lanterns along path, uplit olive tree, outdoor sofa with blankets, editorial, ${STYLE}`,
  },
  {
    file: 'journal-warm-minimal.jpg', size: '1344x768',
    prompt: `Warm minimal living room wide editorial shot, morning light through linen curtains, cream sofa, oak floor, single ceramic vase with branches, ${STYLE}`,
  },
  // ---------- MISC ----------
  {
    file: 'journal-banner.jpg', size: '1344x768',
    prompt: `Moody dark green garden at dusk with wooden sign board, lush plants, warm lantern light, editorial wide banner, deep tones, atmospheric, ${STYLE}`,
  },
  {
    file: 'about-hero.jpg', size: '1344x768',
    prompt: `Sunlit European home goods atelier, wooden shelves with ceramics, lanterns and planters, craft workspace with tools and oak samples, editorial, ${STYLE}`,
  },
  {
    file: 'inspiration-hero.jpg', size: '1344x768',
    prompt: `Airy Mediterranean interior with arch doorway to garden terrace, plants, linen sofa, terracotta floor, bright daylight, wide editorial shot, ${STYLE}`,
  },
  {
    file: 'sustainability-hero.jpg', size: '1344x768',
    prompt: `Natural materials flat lay, oak wood samples, linen fabric, stone, recycled paper packaging, craft rope, soft daylight, editorial, ${STYLE}`,
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zai = await ZAI.create();
  let done = 0;
  const total = jobs.length;

  // filter out already-generated files (allows resume)
  const pending = jobs.filter((j) => {
    const p = path.join(OUT_DIR, j.file);
    if (fs.existsSync(p) && fs.statSync(p).size > 10000) {
      done++;
      return false;
    }
    return true;
  });
  console.log(`Total ${total}, pending ${pending.length}`);

  const CONCURRENCY = 2;
  let index = 0;

  async function worker(workerId: number) {
    while (true) {
      const myIndex = index++;
      if (myIndex >= pending.length) break;
      const job = pending[myIndex];
      const outPath = path.join(OUT_DIR, job.file);
      let lastErr: unknown = null;
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          const response = await zai.images.generations.create({
            prompt: job.prompt,
            size: job.size,
          });
          const b64 = response.data?.[0]?.base64;
          if (!b64) throw new Error('empty response');
          fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
          done++;
          console.log(`[${done}/${total}] OK ${job.file}`);
          lastErr = null;
          await new Promise((r) => setTimeout(r, 1000)); // gentle pacing
          break;
        } catch (err) {
          lastErr = err;
          const is429 = String((err as Error).message).includes('429');
          console.error(`[w${workerId}] attempt ${attempt} failed for ${job.file}: ${(err as Error).message}`);
          await new Promise((r) => setTimeout(r, is429 ? 12000 * attempt : 3000 * attempt));
        }
      }
      if (lastErr) console.error(`[w${workerId}] FINAL FAIL ${job.file}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)));
  console.log('IMAGE GENERATION COMPLETE');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
