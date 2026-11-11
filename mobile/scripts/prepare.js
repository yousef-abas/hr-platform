/* بيجهّز مشروع أندرويد كامل من الصفر: ملفات الويب + مشروع Capacitor + الصلاحيات + الأيقونات.
   بيشتغل على GitHub Actions (وعلى أي جهاز عنده Node 22). */
const { execSync } = require('child_process'), fs = require('fs'), path = require('path');
const run = c => { console.log('\n$ ' + c); execSync(c, { stdio: 'inherit', cwd: __dirname + '/..' }); };
const root = path.join(__dirname, '..');

run('node build-web.js');
if (!fs.existsSync(path.join(root, 'android'))) run('npx cap add android');

/* الصلاحيات والخصوصية */
const mf = path.join(root, 'android/app/src/main/AndroidManifest.xml');
let x = fs.readFileSync(mf, 'utf8');
x = x.replace('android:allowBackup="true"', 'android:allowBackup="false"');
if (!x.includes('ACCESS_FINE_LOCATION')) {
  x = x.replace('<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-feature android:name="android.hardware.location.gps" android:required="false" />');
}
if (!x.includes('ACCESS_FINE_LOCATION') || !x.includes('allowBackup="false"')) throw new Error('تعذر تعديل AndroidManifest.xml');
fs.writeFileSync(mf, x);
console.log('AndroidManifest: صلاحيات الموقع اتضافت، والنسخ الاحتياطي اتقفل');

/* الأيقونة وشاشة البداية — ألوان CLEO HR */
try { run("npx capacitor-assets generate --android --assetPath assets --iconBackgroundColor '#1c0f05' --splashBackgroundColor '#1c0f05'"); }
catch (e) { console.warn('تحذير: ما اتولّدتش الأيقونات، هيتستخدم الأيقونة الافتراضية'); }

run('npx cap sync android');
console.log('\nمشروع أندرويد جاهز في mobile/android');
