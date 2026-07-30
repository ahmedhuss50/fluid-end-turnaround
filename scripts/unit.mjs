import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", args:["--no-sandbox"]});
const p = await b.newPage({ viewport:{width:1200,height:1100}, deviceScaleFactor:2});
await p.goto("http://localhost:3000/units/FE-2200-00841",{waitUntil:"networkidle"});
await p.waitForTimeout(300);
for (const t of ["Work orders","Pass rate","Unit details","Work order history","Chain of custody","Repair requests"]) {
  console.log(t+":", await p.getByText(new RegExp(t,'i')).count());
}
await p.screenshot({path:"/home/claude/unit.png", fullPage:true});
await b.close(); console.log("done");
