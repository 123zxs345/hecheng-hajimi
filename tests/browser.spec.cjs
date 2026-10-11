const {test,expect}=require('@playwright/test');
const origin='http://127.0.0.1:4196/hecheng-hajimi/';
const endpoint='https://tinywebdb.appinventor.space/api';
async function cloudFixture(context,records=new Map()){
  await context.route(endpoint,async route=>{
    const form=new URLSearchParams(route.request().postData());
    if(form.get('action')==='update'){records.set(form.get('tag'),form.get('value'));await route.fulfill({json:{status:'success'},headers:{'access-control-allow-origin':'*'}});return;}
    const entries=[...records].reverse().filter(([tag])=>tag.startsWith(form.get('tag')));
    const start=Number(form.get('no'))-1;await route.fulfill({json:Object.fromEntries(entries.slice(start,start+Number(form.get('count')))),headers:{'access-control-allow-origin':'*'}});
  });
  await context.addInitScript(()=>{window.HajimiTestCloud={endpoint:'https://tinywebdb.appinventor.space/api',user:'test-game',secret:'public-test-key',prefix:'browser_test_'};});
  await context.route('**/hosting-config.js',route=>route.fulfill({contentType:'text/javascript',body:'window.HajimiHosting={tinywebdb:window.HajimiTestCloud};'}));
  return records;
}
async function merge(page){
  await page.evaluate(()=>{gameApp.core.random=()=>0;gameApp.core.reset();});
  const box=await page.locator('#game').boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height*.55);await page.waitForTimeout(650);await page.keyboard.press('Space');
  await expect.poll(()=>page.evaluate(()=>gameApp.best)).toBeGreaterThan(0);
}
test('repository-path assets load, a real merge uploads score and the cover link stays under the project',async({page,context})=>{
  const records=await cloudFixture(context),errors=[],failed=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)failed.push(r.url());});
  await page.goto(origin);await expect.poll(()=>page.evaluate(()=>gameApp?.sprites.filter(s=>s.ready).length)).toBe(11);
  await expect(page.locator('#wallet-count')).toHaveText('1');await merge(page);
  await expect.poll(()=>[...records.keys()].filter(key=>key.includes('player_')).length).toBe(1);
  await page.locator('#share-button').click();await expect(page.locator('#share-link')).toHaveValue(/\/hecheng-hajimi\/\?ref=/);
  await expect(page.locator('#share-cover')).toBeVisible();expect(errors).toEqual([]);expect(failed).toEqual([]);
  await page.screenshot({path:'../../docs/screenshots/hajimi-pages-desktop.png',fullPage:true});
});
test('mobile support uses the supplied QR, no receipt, and a persistent daily coin',async({page})=>{
  await page.setViewportSize({width:375,height:812});await page.goto(origin);await expect(page.locator('#wallet-count')).toHaveText('1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#open-support').click();await expect(page.locator('#support-qr')).toHaveAttribute('src','./support/wechat-pay.jpg');
  await expect(page.locator('#support-qr')).toBeVisible();await expect(page.locator('#payment-receipt')).toHaveCount(0);
  await page.locator('#submit-support').click();await expect(page.locator('#wallet-count')).toHaveText('2');await expect(page.locator('#submit-support')).toBeDisabled();
  await page.locator('#dialog-close').click();await page.reload();await expect(page.locator('#wallet-count')).toHaveText('2');
  await page.locator('#open-support').click();await expect(page.locator('#submit-support')).toBeDisabled();
  await page.screenshot({path:'../../docs/screenshots/hajimi-pages-support.png',fullPage:true});
});
test('all twenty historical ranks are sorted and nicknames render as plain text',async({page,context})=>{
  const records=new Map();for(let n=1;n<=125;n++){const id='00000000-0000-4000-8000-'+String(n).padStart(12,'0');records.set('browser_test_player_'+id,JSON.stringify({id,nickname:n===1?'<猫友1>':'猫友'+n,best:1000-n,updatedAt:n}));}
  await cloudFixture(context,records);await page.goto(origin);await page.locator('#open-ranking').click();
  await expect(page.locator('#ranking-rows tr')).toHaveCount(20);await expect(page.locator('#ranking-rows tr').first()).toContainText('<猫友1>');
  await expect(page.locator('#ranking-rows tr').last()).toContainText('980');await expect(page.locator('#ranking-rows script')).toHaveCount(0);
});
test('cloud failure preserves local merging, the nickname and saved best',async({page,context})=>{
  await cloudFixture(context);await context.route(endpoint,route=>route.abort());await page.goto(origin);await expect(page.locator('#wallet-count')).toHaveText('1');
  await page.locator('#nickname-button').click();await page.locator('#nickname').fill('薄荷小猫');await page.locator('#save-nickname').click();
  await expect(page.locator('#panel')).not.toBeVisible();
  await merge(page);const best=await page.evaluate(()=>gameApp.best);await page.reload();await expect(page.locator('#nickname-button')).toContainText('薄荷小猫');
  expect(await page.evaluate(()=>gameApp.best)).toBe(best);expect(await page.evaluate(()=>gameApp.core.state)).toBe('playing');
});
test('an invited friend earns the inviter one coin after merging, never merely opening',async({browser})=>{
  const records=new Map(),a=await browser.newContext(),b=await browser.newContext();await cloudFixture(a,records);await cloudFixture(b,records);
  try{
    const host=await a.newPage(),guest=await b.newPage();await host.goto(origin);await expect(host.locator('#wallet-count')).toHaveText('1');
    await host.locator('#share-button').click();const link=await host.locator('#share-link').inputValue();await guest.goto(link);await expect(guest.locator('#wallet-count')).toHaveText('1');
    await host.reload();await expect(host.locator('#wallet-count')).toHaveText('1');await merge(guest);
    await expect.poll(()=>[...records.keys()].filter(key=>key.includes('invite_')).length).toBe(1);
    await host.reload();await expect(host.locator('#wallet-count')).toHaveText('2');await host.reload();await expect(host.locator('#wallet-count')).toHaveText('2');
  }finally{await a.close();await b.close();}
});
test('a delayed dialog close event preserves focus when the player has returned to the canvas',async({page})=>{
  await page.goto(origin);await expect(page.locator('#wallet-count')).toHaveText('1');await page.locator('#nickname-button').click();
  await page.evaluate(()=>{document.getElementById('dialog-close').click();document.getElementById('game').focus();});
  await expect(page.locator('#game')).toBeFocused();await page.waitForTimeout(50);await expect(page.locator('#game')).toBeFocused();
  await page.keyboard.press('Space');await expect(page.locator('#panel')).not.toBeVisible();
});
