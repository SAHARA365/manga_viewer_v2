const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// ← 万一のエラーをログに出す
process.on('uncaughtException', console.error);

const imageRoot = path.join(__dirname, 'images');

const cookieParser = require('cookie-parser');
app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));

const AUTH_KEY = "abc123"; // ← 任意のパスコードに変更してOK

// 保護ルートの前に: Cookie認証
app.use((req, res, next) => {
  if (req.path === '/login' || req.path === '/login_check' || req.path.startsWith('/images')) {
    return next(); // ログイン画面と画像は許可
  }
  const cookie = req.cookies.auth;
  if (cookie === AUTH_KEY) {
    return next(); // 通過OK
  } else {
    return res.redirect('/login');
  }
});

// 静的ファイル配信
app.use('/images', express.static(imageRoot));
app.use(express.static(__dirname));

// 🔧 ファイル名から (数字) を抽出して数値ソートに使う
function extractNumber(filename) {
  const match = filename.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// 🔸 トップページ：漫画表紙一覧
app.get('/', (req, res) => {
  console.log("★★ / にアクセスされた ★★");

  const folders = fs.readdirSync(imageRoot, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const folderEntries = folders.map(folder => {
    const folderPath = path.join(imageRoot, folder);
    const files = fs.readdirSync(folderPath)
      .filter(f => /\.(avif|jpg|jpeg|png|webp)$/i.test(f))
      .sort((a, b) => extractNumber(a) - extractNumber(b));

    const thumbnail = files.length > 0
      ? `/images/${encodeURIComponent(folder)}/${encodeURIComponent(files[0])}`
      : null;

    // デバッグ出力
    console.log(`[LINK] /gallery?title=${encodeURIComponent(folder)}`);

    return { title: folder, thumbnail };
  });

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>漫画一覧</title>
      <style>
        body { font-family: sans-serif; background: #f2f2f2; padding: 2em; }
        h1 { text-align: center; }
        .gallery { display: flex; flex-wrap: wrap; gap: 1.5em; justify-content: center; }
        .item { width: 160px; text-align: center; }
        .item img {
          width: 100%;
          height: auto;
          border: 1px solid #ccc;
          border-radius: 8px;
          background: white;
        }
        .item a {
          text-decoration: none;
          color: #333;
          font-size: 1em;
          display: block;
          margin-top: 0.5em;
        }
      </style>
    </head>
    <body>
      <h1>漫画一覧</h1>
      <div class="gallery">
        ${folderEntries.map(entry => `
          <div class="item">
            <a href="/gallery?title=${encodeURIComponent(entry.title)}">
              ${entry.thumbnail
                ? `<img src="${entry.thumbnail}" alt="${entry.title}">`
                : '<div style="width:100%;height:200px;background:#ddd;"></div>'}
              <span>${entry.title}</span>
            </a>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// 🔸 ギャラリーページ：1作品の画像一覧
app.get('/gallery', (req, res) => {
  const title = req.query.title;
  const dirPath = path.join(imageRoot, title);

  if (!fs.existsSync(dirPath)) {
    return res.status(404).send('フォルダが存在しません');
  }

  const files = fs.readdirSync(dirPath)
    .filter(f => /\.(avif|jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b));

  console.log(`📂 /gallery ${title} → ファイル数: ${files.length}`);

  const html = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>${title} - サムネイル一覧</title>
      <style>
        body { font-family: sans-serif; background: #fff; padding: 2em; }
        h1 { text-align: center; }
        .thumbs {
          display: flex;
          flex-wrap: wrap;
          gap: 1em;
          justify-content: center;
        }
        .thumb {
          width: 120px;
          cursor: pointer;
        }
        .thumb img {
          width: 100%;
          height: auto;
          border: 1px solid #aaa;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="thumbs">
        ${files.map((file, idx) => `
          <div class="thumb">
            <a href="viewer.html?title=${encodeURIComponent(title)}&index=${idx}">
              <img src="/images/${encodeURIComponent(title)}/${encodeURIComponent(file)}" alt="page ${idx + 1}">
            </a>
          </div>
        `).join('')}
      </div>
    </body>
    </html>
  `;

  res.send(html);
});

// 🔸 viewer.html 用：ファイル一覧(JSON)
app.get('/list', (req, res) => {
  const title = req.query.title;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const dirPath = path.join(imageRoot, title);
  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'not found' });

  const files = fs.readdirSync(dirPath)
    .filter(f => /\.(avif|jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b));

  res.json(files);
});

// ログインページ
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ja"><head><meta charset="UTF-8"><title>ログイン</title></head>
    <body>
      <h1>端末認証</h1>
      <form method="POST" action="/login_check">
        <input name="key" type="password" placeholder="パスコード">
        <button type="submit">認証</button>
      </form>
    </body></html>
  `);
});

// ログイン確認処理
app.post('/login_check', (req, res) => {
  const key = req.body.key;
  if (key === AUTH_KEY) {
    res.cookie('auth', AUTH_KEY, { httpOnly: true });
    res.redirect('/');
  } else {
    res.send('<h1>パスコードが間違っています</h1><a href="/login">戻る</a>');
  }
});

// 🔸 サーバー起動
app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
