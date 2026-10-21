import { PrismaClient } from '../src/generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { sweepSafety } from '../src/lib/safety-sweep.ts';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const db = new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})});
let stopping=false;
process.on('SIGINT',()=>{stopping=true;});process.on('SIGTERM',()=>{stopping=true;});
try {
 do {
  try { await sweepSafety(db,process.env.SAFETY_FOUNDER_USER_ID?.trim()||''); }
  catch(error) { console.error('Safety sweep failed; it will retry.',error?.code||'unexpected error'); if(process.argv.includes('--once'))process.exitCode=1; }
  if(process.argv.includes('--once'))break;
  for(let tick=0;tick<30&&!stopping;tick++)await new Promise(resolve=>setTimeout(resolve,1000));
 }while(!stopping);
}finally {await db.$disconnect();}
