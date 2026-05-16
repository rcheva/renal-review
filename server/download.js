const fs = require('fs');
const https = require('https');

const authFile = fs.readFileSync('/Users/julio/.notebooklm-mcp/auth.json', 'utf8');
const auth = JSON.parse(authFile);

const cookieString = Object.entries(auth.cookies).map(([k, v]) => `${k}=${v}`).join('; ');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, {
      headers: {
        'Cookie': cookieString,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    }, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  try {
    await download("https://lh3.googleusercontent.com/notebooklm/AKXwDQES1yZAyBAULLOtGW8Kt7VuO1_MzphvxfNBiE6VbF3QVfgytru5qjgOScOOPbIigRYGO4PWnIJUNitxtsd6GAeuiq_c5ePZ-CRrMBjaHSxG0Gz8Jpr8ZYbtB5FHskuQaJytXhyKWK3jZh-MPZG1isQMxfo3dlE=m140-dv", "/Users/julio/projects/Renal_Review/skola-main/public/media/ckd_audio.wav");
    console.log("Downloaded CKD audio");
    
    await download("https://lh3.googleusercontent.com/notebooklm/AKXwDQFyHLQniGbuNcQ346E-zBiqtd9iDljAqZ5TzoM8BKo6iVjSDiE5eMz4AFktkjiSZ5oJYbFyGLCBUmqR05Bd0DfrzhEj_m24SaRpxUIJNKDJrRuMOO-EzFWbUdS9d9uD8-b5B3iNI6war7dcvN20BX14aVVzvA=m140-dv", "/Users/julio/projects/Renal_Review/skola-main/public/media/aki_audio.wav");
    console.log("Downloaded AKI audio");

  } catch(e) {
    console.error(e);
  }
}
main();
