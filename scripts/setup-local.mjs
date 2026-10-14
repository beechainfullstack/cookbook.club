import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';

if (existsSync('.env')) {
  console.error('A local .env already exists. Edit it manually instead of overwriting it.');
  process.exit(1);
}
const status = JSON.parse(execFileSync('npx', ['supabase', 'status', '--output', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
writeFileSync('.env', `EXPO_PUBLIC_SUPABASE_URL=${status.API_URL}\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${status.ANON_KEY}\nEXPO_PUBLIC_AUTH_REDIRECT_URL=\n`, { mode: 0o600 });
console.log('Created ignored local configuration. No keys printed.');
