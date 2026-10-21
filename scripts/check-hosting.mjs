const errors=[],notes=[];
function database(name,required=true){const value=process.env[name];if(!value){if(required)errors.push(`${name} is missing.`);return;}try{const url=new URL(value);if(!['postgres:','postgresql:'].includes(url.protocol))errors.push(`${name} must be a TCP PostgreSQL connection string for PrismaPg.`);if(['localhost','127.0.0.1','::1'].includes(url.hostname))errors.push(`${name} points at a local database, not Prisma Postgres.`);}catch{errors.push(`${name} is not a valid database URL.`);}}
database('DATABASE_URL');database('DIRECT_URL');
try{const url=new URL(process.env.BETTER_AUTH_URL);if(url.protocol!=='https:'||['localhost','127.0.0.1'].includes(url.hostname))errors.push('BETTER_AUTH_URL must be the hosted HTTPS app URL.');}catch{errors.push('BETTER_AUTH_URL is missing or invalid.');}
if(!process.env.BETTER_AUTH_SECRET||process.env.BETTER_AUTH_SECRET.length<32||process.env.BETTER_AUTH_SECRET.startsWith('replace-'))errors.push('Set a strong production BETTER_AUTH_SECRET.');
if(process.env.MEDIA_STORAGE!=='vercel-blob')errors.push('MEDIA_STORAGE must be vercel-blob for hosted uploads.');
if(!process.env.BLOB_READ_WRITE_TOKEN&&!(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN))errors.push('Connect a private Vercel Blob store.');
if(!process.env.SAFETY_FOUNDER_USER_ID)errors.push('Pin SAFETY_FOUNDER_USER_ID to the founder account in the hosted database.');
if(!process.env.CRON_SECRET||process.env.CRON_SECRET.length<32)errors.push('Set a random CRON_SECRET of at least 32 characters.');
if(process.env.DIDIT_ENABLED!=='true')notes.push('Identity checks remain disabled; publishing and collaboration participation stay blocked.');
notes.push('Run db:deploy against the target database before serving traffic. Confirm the founder account exists there.');
notes.push('Configure the protected maintenance endpoint on a persistent scheduler at least every 5 minutes; this is not enabled by a build.');
notes.push('In-app alerts do not provide external emergency notification delivery.');
for(const note of notes)console.log(`NOTE: ${note}`);
for(const error of errors)console.error(`REQUIRED: ${error}`);
if(errors.length){console.error('Hosted configuration is not ready. No secrets were printed and no remote resources were changed.');process.exitCode=1;}else console.log('Hosted environment values pass static checks. Live provider connectivity and delivery still require verification.');
