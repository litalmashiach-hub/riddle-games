// TEST ONLY. Sets the home screen icon look (Light, Dark, Tinted) through the Home Screen's own Customize
// sheet, by Appium on the SpringBoard, then leaves edit mode so the caller can photograph the home screen.
//   node springboard.mjs <udid> <look> <outdir>
import { remote } from 'webdriverio';
import { writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
const [udid, look, out] = process.argv.slice(2);
const log = (s) => { console.log(s); appendFileSync(join(out, 'springboard-log.txt'), `${new Date().toISOString()} [${look}] ${s}\n`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const d = await remote({
  hostname: '127.0.0.1', port: 4723, logLevel: 'warn', connectionRetryTimeout: 1800000,
  capabilities: {
    platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': udid, 'appium:noReset': true,
    'appium:newCommandTimeout': 1800, 'appium:wdaLaunchTimeout': 1800000, 'appium:wdaConnectionTimeout': 1800000,
    'appium:waitForIdleTimeout': 0, 'appium:skipLogCapture': true, 'appium:bundleId': 'com.apple.springboard',
    'appium:autoLaunch': false,
  },
});
const dump = async (name) => { try { writeFileSync(join(out, `source-${look}-${name}.xml`), await d.getPageSource()); } catch (e) { log(`source ${name} failed: ${e}`); } };
const find = async (names, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    for (const n of names) {
      const el = await d.$(`~${n}`);
      if (await el.isExisting()) return { el, n };
    }
    await sleep(700);
  }
  return null;
};
let ok = false;
try {
  await d.execute('mobile: pressButton', { name: 'home' });
  await sleep(1500);
  const { width, height } = await d.getWindowSize();
  log(`window ${width}x${height}`);
  // An empty spot of the first page, below the apps and above the dock.
  await d.execute('mobile: touchAndHold', { x: Math.round(width * 0.5), y: Math.round(height * 0.66), duration: 2.0 });
  await sleep(1500);
  await dump('1-held');
  const edit = await find(['Edit', 'edit']);
  if (!edit) throw new Error('no Edit button after the long press');
  await edit.el.click(); log(`pressed ${edit.n}`);
  await sleep(1200);
  await dump('2-edit-menu');
  const cust = await find(['Customize', 'Customise']);
  if (!cust) throw new Error('no Customize in the Edit menu');
  await cust.el.click(); log(`pressed ${cust.n}`);
  await sleep(2000);
  await dump('3-customize');
  const names = look === 'light' ? ['Light', 'Default'] : look === 'dark' ? ['Dark'] : ['Tinted'];
  const btn = await find(names);
  if (!btn) throw new Error(`no ${names.join('/')} in the Customize sheet`);
  await btn.el.click(); log(`pressed ${btn.n}`);
  await sleep(2500);
  await dump('4-chosen');
  // Close the sheet by tapping the top of the screen, then leave edit mode.
  await d.execute('mobile: tap', { x: Math.round(width * 0.5), y: Math.round(height * 0.12) });
  await sleep(1500);
  const done = await find(['Done'], 3000);
  if (done) { await done.el.click(); log('pressed Done'); }
  await d.execute('mobile: pressButton', { name: 'home' });
  await sleep(3000);
  await dump('5-home');
  ok = true;
} catch (e) {
  log(`failed: ${e}`);
  await dump('error');
} finally {
  await d.deleteSession().catch(() => {});
}
process.exit(ok ? 0 : 1);
