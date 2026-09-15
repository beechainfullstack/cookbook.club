import { readFileSync, writeFileSync } from 'node:fs';

const copy = JSON.parse(readFileSync(new URL('../copy.json', import.meta.url), 'utf8'));
const configPath = new URL('../supabase/config.toml', import.meta.url);
const config = readFileSync(configPath, 'utf8');
if (typeof copy.notifications.sms !== 'string' || !copy.notifications.sms.includes('{{ .Code }}')) {
  throw new Error('copy.notifications.sms must contain {{ .Code }}');
}
const section = /(\[auth\.sms\][\s\S]*?\ntemplate = )("[^\n]*")/;
if (!section.test(config)) throw new Error('Missing auth.sms.template');
writeFileSync(configPath, config.replace(section, (_, prefix) => prefix + JSON.stringify(copy.notifications.sms)));
