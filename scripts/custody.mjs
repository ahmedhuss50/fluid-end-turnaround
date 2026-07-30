import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args:["--no-sandbox"]});
const p = await b.newPage({ viewport:{width:1200,height:1000}, deviceScaleFactor:2});
const sub = async(loc)=>{ await Promise.all([p.waitForResponse(r=>r.request().method()==='POST').catch(()=>{}), loc.click()]); await p.waitForLoadState('networkidle').catch(()=>{}); };
// submit request with pickup
await p.goto("http://localhost:3000/requests",{waitUntil:"networkidle"});
await p.fill('input[name="contactName"]','R. Nguyen');
await p.fill('input[name="serialNumber"]','FE-9000-00001');
await p.fill('input[name="manufacturer"]','SPM');
await p.fill('textarea[name="problem"]','Full turnaround needed.');
await p.selectOption('select[name="deliveryMethod"]','PICKUP');
await p.fill('input[name="clientSignerName"]','R. Nguyen');
await sub(p.getByRole('button',{name:/Submit repair request/i}));
// go to requests, click start work order for that serial
await p.goto("http://localhost:3000/requests",{waitUntil:"networkidle"});
const href = await p.locator('tr', {has: p.getByText('FE-9000-00001')}).locator('a', {hasText:/Start work order/i}).getAttribute('href');
await p.goto("http://localhost:3000"+href,{waitUntil:"networkidle"});
console.log("delivery prefilled:", await p.locator('select[name="deliveryMethod"]').inputValue());
console.log("released prefilled:", await p.locator('input[name="releasedByClient"]').inputValue());
// fill received by + technician, run pressure test, create
await p.fill('input[name="technician"]','Jacob Ramirez');
await p.fill('input[name="receivedByPsi"]','Jacob Ramirez');
await p.getByRole('button',{name:/Start test/i}).click();
await p.waitForTimeout(6200);
await p.getByRole('button',{name:/^■ Stop|Stop$/i}).first().click().catch(()=>{});
await sub(p.getByRole('button',{name:/Create work order/i}));
console.log("on job page:", p.url().includes('/jobs/'));
console.log("custody card:", await p.getByText(/Chain of custody/i).count());
console.log("psi picked up shown:", await p.getByText(/PSI picks up/i).count());
await p.screenshot({path:"/home/claude/custody.png", fullPage:true});
await b.close(); console.log("done");
