/* بيجمّع ملفات تطبيق الويب (employee + الملفات المشتركة من admin) في فولدر www اللي Capacitor بيحطه جوه التطبيق */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), www = path.join(__dirname, 'www');
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) { const a = path.join(from, f), b = path.join(to, f); fs.statSync(a).isDirectory() ? copyDir(a, b) : copy(a, b); } };

fs.rmSync(www, { recursive: true, force: true });
copyDir(path.join(root, 'employee'), path.join(www, 'employee'));
fs.rmSync(path.join(www, 'employee', 'sw.js'), { force: true });          // مفيش داعي لـ service worker جوه التطبيق

/* أي ملف مشترك بيشير له employee/index.html من ../admin/ ينسخ بنفس المسار */
const html = fs.readFileSync(path.join(root, 'employee', 'index.html'), 'utf8');
const shared = [...html.matchAll(/(?:src|href)="\.\.\/(admin\/[^"]+)"/g)].map(m => m[1]);
if (!shared.length) throw new Error('ما لقيتش ملفات admin مشتركة في employee/index.html');
for (const rel of shared) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) throw new Error('ملف ناقص: ' + rel);
  copy(src, path.join(www, rel));
}
fs.writeFileSync(path.join(www, 'index.html'), '<!DOCTYPE html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=employee/index.html"><title>تطبيق الموظفين</title>');

/* فحص: إعدادات الاتصال لازم تكون مملية، وإلا التطبيق هيفتح في الوضع التجريبي */
const cfg = fs.readFileSync(path.join(www, 'admin/js/config.js'), 'utf8');
if (!/supabaseUrl:\s*'https?:\/\/[^']+'/.test(cfg) || !/supabaseKey:\s*'[^']+'/.test(cfg)) throw new Error('admin/js/config.js فيه supabaseUrl أو supabaseKey فاضي');
console.log('www جاهز:', shared.length, 'ملف مشترك من admin + تطبيق employee');
