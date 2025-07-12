const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;
const imageRoot = path.join(__dirname, 'images');
const AUTH_KEY = process.env.AUTH_KEY || "default123";

function extractNumber(filename) {
  const match = filename.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 認証ミドルウェア（ログインページと静的ファイル以外を保護）
app.use((req, res, next) => {
  if (
    req.path === '/login' ||
    req.path === '/login_check' ||
    req.path.startsWith('/images') ||
    req.path === '/index.html' ||
    req.path === '/viewer.html'
  ) {
    return next();
  }
  if (req.cookies.auth === AUTH_KEY) return next();
  res.redirect('/login');
});

// 静的ファイルの配信
app.use('/images', express.static(imageRoot));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// トップページ（index.htmlを返す）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 表紙画像API
app.get('/api/cover-image', (req, res) => {
  const title = req.query.title;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const dirPath = path.join(imageRoot, title);
  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'folder not found' });

  const files = fs.readdirSync(dirPath)
    .filter(f => /\.(avif|jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b));

  if (files.length === 0) return res.status(404).json({ error: 'no images' });

  const coverUrl = `/images/${encodeURIComponent(title)}/${encodeURIComponent(files[0])}`;
  res.json({ cover: coverUrl });
});

// 画像一覧API
app.get('/list', (req, res) => {
  const title = req.query.title;
  const dirPath = path.join(imageRoot, title || '');
  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'not found' });

  const files = fs.readdirSync(dirPath)
    .filter(f => /\.(avif|jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b));

  res.json(files);
});

// すべての漫画フォルダを返すAPI
app.get('/api/all-folders', (req, res) => {
  try {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    const folders = fs.readdirSync(imageRoot, { withFileTypes: true })
      .filter(function (dirent) {
        return dirent.isDirectory();
      })
      .map(function (dirent) {
        return dirent.name;
      })
      .sort(function (a, b) {
        return collator.compare(a, b);
      });

    res.json(folders);
  } catch (err) {
    console.error("Folder listing failed:", err);
    res.status(500).json({ error: 'failed to read image folders' });
  }
});

// タグ更新API
app.post('/api/update-tags', (req, res) => {
  const { title, tags } = req.body;
  if (!title || !Array.isArray(tags)) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const metadataPath = path.join(__dirname, 'public', 'metadata.json');
  let metadata = {};

  try {
    if (fs.existsSync(metadataPath)) {
      metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to read metadata:', err);
    return res.status(500).json({ error: 'Failed to read metadata' });
  }

  metadata[title] = metadata[title] || {};
  metadata[title].tags = tags;

  try {
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to write metadata:', err);
    res.status(500).json({ error: 'Failed to write metadata' });
  }
});

// 画像一覧API
app.get('/list', (req, res) => {
  const title = req.query.title;
  const dirPath = path.join(imageRoot, title || '');

  console.log("📂 /list API title:", title);
  console.log("📁 resolved path:", dirPath);

  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'not found' });

  const files = fs.readdirSync(dirPath)
    .filter(f => /\.(avif|jpg|jpeg|png|webp)$/i.test(f))
    .sort((a, b) => extractNumber(a) - extractNumber(b));

  res.json(files);
});

// ログインチェック
app.post('/login_check', (req, res) => {
  const pass = req.body.passcode;
  if (pass === AUTH_KEY) {
    res.cookie('auth', AUTH_KEY, { httpOnly: true });
    res.redirect('/index.html');
  } else {
    res.send('認証失敗: パスコードが間違っています');
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
