import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const OUT_DIR = '/home/z/my-project/public/images';

type Job = { file: string; size: string; prompt: string };

const STYLE = 'warm editorial interior photography, European home and garden aesthetic, natural materials, oak wood, linen, cream and olive tones, soft natural light, photorealistic, premium magazine quality, no text, no watermark';

// [shortName, subject description used in prompts]
const PRODUCTS: Array<[string, string]> = [
  ['wood-slat-panel', 'oak wood slat wall panel'],
  ['led-table-lamp', 'portable rechargeable LED table lamp with mushroom shape and matte cream finish'],
  ['arched-mirror', 'arched wall mirror with thin brass frame'],
  ['ceramic-planter', 'set of two ribbed cream ceramic planters'],
  ['solar-lantern', 'set of two black metal solar garden lanterns with warm glowing LED candles'],
  ['outdoor-sofa', 'modern outdoor sofa with natural acacia wood frame and beige weather-resistant cushions'],
  ['rattan-chair', 'sculptural rattan accent chair with curved back in natural tone'],
  ['linen-cushions', 'set of three linen cushion covers in olive, caramel and cream tones'],
  ['oak-wall-shelf', 'minimal oak wood wall shelf'],
  ['pendant-lamp', 'woven rattan pendant lamp'],
  ['garden-torch', 'modern garden flame torch in black steel with wooden pole'],
  ['seagrass-basket', 'set of two seagrass storage baskets with handles'],
  ['teak-bench', 'solid teak wood entryway bench with slatted top'],
  ['ceramic-vase-set', 'set of three matte ceramic vases in terracotta, sand and off-white'],
  ['palm-planter', 'tall architectural fiberstone planter in warm grey with kentia palm'],
  ['string-lights', 'solar string lights with warm glowing bulbs'],
  ['wall-clock', 'large minimal wooden wall clock in oak'],
  ['fire-pit', 'round outdoor fire pit table in dark grey fiberstone with visible flames'],
];

function lifestylePrompt(subject: string): string {
  return `Lifestyle interior photography of ${subject}, styled in a beautiful European living space in natural in-situ context, wide enough framing to show the room mood, ${STYLE}`;
}

function detailPrompt(subject: string): string {
  return `Extreme close-up detail photography of ${subject}, focus on texture, material grain and craftsmanship, shallow depth of field, warm side light, ${STYLE}`;
}

const jobs: Job[] = [];
for (const [short, subject] of PRODUCTS) {
  jobs.push({ file: `gallery-${short}-lifestyle.jpg`, size: '1024x1024', prompt: lifestylePrompt(subject) });
  jobs.push({ file: `gallery-${short}-detail.jpg`, size: '1024x1024', prompt: detailPrompt(subject) });
}

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
  console.log('GALLERY IMAGE GENERATION COMPLETE');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
