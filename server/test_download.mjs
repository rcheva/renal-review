import fs from 'fs';
import path from 'path';
import os from 'os';

async function testDownload() {
  const url = "https://lh3.googleusercontent.com/notebooklm/AKXwDQFMyraKboAqxOfXYnRE-MJ_CtSBjyEh_93rQuGj2Xf4h58EGczA1znY2AOFQ_qXSI5c3XZKIIOCF_C7dJb4O7bwBLBZniSNdCR736SZITveOTeQzjWspLoA64SeVnY1rdV95pP628XjWtce7FCy2JJizHIkhw=m140-dv";
  const authPath = path.join(os.homedir(), '.notebooklm-mcp', 'auth.json');
  const authFile = fs.readFileSync(authPath, 'utf8');
  const auth = JSON.parse(authFile);
  const cookieString = Object.entries(auth.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

  const response = await fetch(url, {
    headers: {
      'Cookie': cookieString,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    }
  });

  console.log("Status:", response.status, response.statusText);
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    console.log("Downloaded", buffer.byteLength, "bytes");
  } else {
    const text = await response.text();
    console.log("Error body:", text.substring(0, 500));
  }
}
testDownload();
