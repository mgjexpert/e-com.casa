import { readFileSync } from 'node:fs';
import { saveProductOffer } from '../../src/lib/offers/store';
import { db } from '../../src/lib/db';
const [file, actor] = process.argv.slice(2);
if (!file || !actor) throw Error('Usage: bun scripts/catalog-partners/manage-offer.ts offer.json operator-identity');
try { console.log(JSON.stringify(await saveProductOffer(JSON.parse(readFileSync(file,'utf8')),actor),null,2)); } finally { await db.$disconnect(); }
