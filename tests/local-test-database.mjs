export function requireLocalTestDatabase(value) {
 let url;
 try { url = new URL(value); } catch { throw new Error('Integration tests require the local business_collab database.'); }
 if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/business_collab') throw new Error('Integration tests require the local business_collab database.');
}
