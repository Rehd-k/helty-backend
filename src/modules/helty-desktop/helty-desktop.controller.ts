import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import type { Request } from 'express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { HeltyDesktopService } from './helty-desktop.service';
import { UploadHeltyDesktopDto } from './dto/upload-helty-desktop.dto';

const TMP_DIR = path.join(process.cwd(), 'uploads', 'helty-desktop', 'tmp');
const MAX_FILE_BYTES = 500 * 1024 * 1024;

const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      cb(null, TMP_DIR);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${nanoid()}.upload`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.exe') {
      return cb(
        new BadRequestException('Only Windows .exe installers are allowed'),
        false,
      );
    }
    cb(null, true);
  },
});

function publicBaseUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol;
  const host = req.get('host') || 'localhost';
  return `${proto}://${host}`;
}

@ApiTags('Helty Desktop (Flutter Windows)')
@Controller('helty-desktop')
export class HeltyDesktopController {
  constructor(private readonly heltyDesktop: HeltyDesktopService) {}

  @Public()
  @Get('update/latest')
  @ApiOperation({
    summary: 'Latest version string (for updater / Flutter)',
  })
  async latestVersion() {
    return this.heltyDesktop.getLatestVersionJson();
  }

  @Public()
  @Get('update/manifest')
  @ApiOperation({
    summary: 'Version + absolute download URL (convenience for Flutter)',
  })
  manifest(@Req() req: Request) {
    return this.heltyDesktop.getManifest(publicBaseUrl(req));
  }

  @Public()
  @Get('releases')
  @ApiOperation({ summary: 'List all published releases' })
  list() {
    return this.heltyDesktop.listReleases();
  }

  @Public()
  @Get('download/latest')
  @ApiOperation({ summary: 'Download the latest .exe installer' })
  async downloadLatest(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.heltyDesktop.pipeDownloadToResponse(
      res,
      'latest',
      publicBaseUrl(req),
    );
  }

  @Public()
  @Get('download/version/:version')
  @ApiOperation({ summary: 'Download a specific version by version string' })
  async downloadVersion(
    @Param('version') version: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.heltyDesktop.pipeDownloadToResponse(
      res,
      version,
      publicBaseUrl(req),
    );
  }

  @Public()
  @Post('upload')
  @UseInterceptors(uploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['version', 'password', 'file'],
      properties: {
        version: { type: 'string', example: '1.2.3' },
        password: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a new Windows .exe (password-protected)' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadHeltyDesktopDto,
    @Headers('x-helty-upload-password') headerPassword?: string,
  ) {
    if (!file?.path) {
      throw new BadRequestException('file is required');
    }
    this.heltyDesktop.assertUploadPassword(body?.password, headerPassword);
    return this.heltyDesktop.createReleaseFromUpload(body.version, file.path);
  }

  @Public()
  @Get('ui/upload')
  @ApiOperation({ summary: 'Browser upload page (password + progress bar)' })
  uploadPage(@Res() res: Response) {
    res.type('html').send(UPLOAD_HTML);
  }

  @Public()
  @Get('ui/downloads')
  @ApiOperation({ summary: 'Browser downloads page (list + download buttons)' })
  downloadsPage(@Res() res: Response) {
    res.type('html').send(DOWNLOADS_HTML);
  }
}

const UPLOAD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Helty Desktop — Upload installer</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c1222;
      --card: #151d2e;
      --accent: #38bdf8;
      --accent2: #a78bfa;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      font-family: 'DM Sans', system-ui, sans-serif;
      background: radial-gradient(ellipse 120% 80% at 50% -20%, #1e3a5f 0%, var(--bg) 55%);
      color: var(--text);
      display: flex; align-items: center; justify-content: center;
      padding: 1.5rem;
    }
    .shell {
      width: 100%; max-width: 440px;
      background: linear-gradient(145deg, rgba(30,41,59,.8), rgba(15,23,42,.95));
      border: 1px solid rgba(148,163,184,.15);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,.5);
    }
    h1 {
      font-size: 1.35rem; font-weight: 700; margin: 0 0 .25rem;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p.sub { margin: 0 0 1.5rem; color: var(--muted); font-size: .9rem; }
    label { display: block; font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin-bottom: .35rem; }
    input[type="text"], input[type="password"], input[type="file"] {
      width: 100%; padding: .65rem .85rem; border-radius: 10px;
      border: 1px solid rgba(148,163,184,.25);
      background: rgba(15,23,42,.6); color: var(--text);
      font-size: .95rem; margin-bottom: 1rem;
    }
    input[type="file"] { padding: .5rem; cursor: pointer; }
    button {
      width: 100%; padding: .85rem 1rem; border: none; border-radius: 12px;
      font-weight: 600; font-size: 1rem; cursor: pointer;
      background: linear-gradient(135deg, var(--accent), #2563eb);
      color: #0f172a;
      transition: transform .15s, box-shadow .15s;
    }
    button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 25px -5px rgba(56,189,248,.4); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .bar-wrap {
      margin-top: 1.25rem; height: 8px; border-radius: 999px;
      background: rgba(148,163,184,.15); overflow: hidden; display: none;
    }
    .bar-wrap.active { display: block; }
    .bar {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      border-radius: 999px;
      transition: width .12s ease-out;
    }
    .status { margin-top: .75rem; font-size: .85rem; color: var(--muted); min-height: 1.25rem; }
    .ok { color: #4ade80; }
    .err { color: #f87171; }
  </style>
</head>
<body>
  <div class="shell">
    <h1>Helty Desktop — Upload</h1>
    <p class="sub">Publish a new Windows build. File is stored as <code>helty{version}.exe</code>.</p>
    <form id="f">
      <label for="version">Version</label>
      <input id="version" name="version" type="text" placeholder="e.g. 1.4.0" required autocomplete="off" />
      <label for="password">Upload password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" />
      <label for="file">Installer (.exe)</label>
      <input id="file" name="file" type="file" accept=".exe" required />
      <button type="submit" id="btn">Upload</button>
    </form>
    <div class="bar-wrap" id="barWrap"><div class="bar" id="bar"></div></div>
    <div class="status" id="status"></div>
  </div>
  <script>
    const f = document.getElementById('f');
    const bar = document.getElementById('bar');
    const barWrap = document.getElementById('barWrap');
    const status = document.getElementById('status');
    const btn = document.getElementById('btn');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      const version = document.getElementById('version').value.trim();
      const password = document.getElementById('password').value;
      const fileInput = document.getElementById('file');
      const file = fileInput.files[0];
      if (!file) { status.textContent = 'Choose a file.'; status.className = 'status err'; return; }
      const fd = new FormData();
      fd.append('version', version);
      fd.append('password', password);
      fd.append('file', file);
      status.className = 'status';
      status.textContent = 'Uploading…';
      barWrap.classList.add('active');
      bar.style.width = '0%';
      btn.disabled = true;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '../upload');
      xhr.upload.onprogress = function (ev) {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          bar.style.width = pct + '%';
        }
      };
      xhr.onload = function () {
        btn.disabled = false;
        barWrap.classList.remove('active');
        try {
          const j = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300) {
            status.className = 'status ok';
            status.textContent = 'Published ' + (j.version || version) + ' — ' + (j.fileName || '');
          } else {
            status.className = 'status err';
            status.textContent = (j.message || xhr.statusText || 'Upload failed');
          }
        } catch {
          status.className = 'status err';
          status.textContent = xhr.status >= 400 ? (xhr.responseText || 'Error') : 'Done';
        }
      };
      xhr.onerror = function () {
        btn.disabled = false;
        barWrap.classList.remove('active');
        status.className = 'status err';
        status.textContent = 'Network error';
      };
      xhr.send(fd);
    });
  </script>
</body>
</html>`;

const DOWNLOADS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Helty Desktop — Downloads</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c1222;
      --card: #151d2e;
      --accent: #38bdf8;
      --accent2: #a78bfa;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      font-family: 'DM Sans', system-ui, sans-serif;
      background: radial-gradient(ellipse 120% 80% at 50% -20%, #1e3a5f 0%, var(--bg) 55%);
      color: var(--text);
      padding: 1.5rem;
    }
    .shell { max-width: 720px; margin: 0 auto; }
    h1 {
      font-size: 1.5rem; font-weight: 700; margin: 0 0 .5rem;
      background: linear-gradient(90deg, var(--accent), var(--accent2));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    p.sub { margin: 0 0 1.5rem; color: var(--muted); font-size: .95rem; }
    .card {
      background: linear-gradient(145deg, rgba(30,41,59,.8), rgba(15,23,42,.95));
      border: 1px solid rgba(148,163,184,.15);
      border-radius: 16px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: .85rem 1rem; text-align: left; font-size: .9rem; }
    th { color: var(--muted); font-weight: 600; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid rgba(148,163,184,.12); }
    tr:not(:last-child) td { border-bottom: 1px solid rgba(148,163,184,.08); }
    .badge {
      display: inline-block; padding: .2rem .5rem; border-radius: 6px;
      font-size: .75rem; font-weight: 600;
      background: rgba(56,189,248,.15); color: var(--accent);
    }
    a.btn {
      display: inline-block; padding: .45rem .85rem; border-radius: 8px;
      font-size: .85rem; font-weight: 600; text-decoration: none;
      background: linear-gradient(135deg, var(--accent), #2563eb);
      color: #0f172a;
    }
    a.btn:hover { opacity: .92; }
    .loading { color: var(--muted); padding: 1.5rem; }
    .err { color: #f87171; padding: 1rem; }
  </style>
</head>
<body>
  <div class="shell">
    <h1>Helty Desktop — Downloads</h1>
    <p class="sub">Latest installers built for Windows. Use the API for automated updates from your Flutter app.</p>
    <div class="card" id="root"><div class="loading">Loading…</div></div>
  </div>
  <script>
    const root = document.getElementById('root');
    fetch('../releases')
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
          root.innerHTML = '<p class="loading">No releases yet. Upload a build from <a href="../ui/upload" style="color:#38bdf8">upload page</a>.</p>';
          return;
        }
        let html = '<table><thead><tr><th>Version</th><th>File</th><th>Published</th><th></th></tr></thead><tbody>';
        rows.forEach(function (row, i) {
          const v = row.version.replace(/</g, '');
          const fn = (row.fileName || '').replace(/</g, '');
          const d = row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
          const badge = i === 0 ? '<span class="badge">Latest</span> ' : '';
          html += '<tr><td>' + badge + v + '</td><td><code style="font-size:.8rem;opacity:.9">' + fn + '</code></td><td style="color:#94a3b8;font-size:.85rem">' + d + '</td>';
          html += '<td><a class="btn" href="../download/version/' + encodeURIComponent(row.version) + '">Download</a></td></tr>';
        });
        html += '</tbody></table>';
        root.innerHTML = html;
      })
      .catch(function () {
        root.innerHTML = '<div class="err">Could not load releases.</div>';
      });
  </script>
</body>
</html>`;
