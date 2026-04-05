import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
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
import { DeleteHeltyDesktopDto } from './dto/delete-helty-desktop.dto';
import { UploadHeltyDesktopExternalExecutableDto } from './dto/upload-helty-desktop-external-executable.dto';

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
  @Get('assets')
  @ApiOperation({ summary: 'List uploaded extra executables' })
  assets() {
    return this.heltyDesktop.listExternalExecutables();
  }

  @Public()
  @Post('assets/upload')
  @UseInterceptors(uploadInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'password', 'file'],
      properties: {
        name: { type: 'string', example: 'toolname.exe' },
        description: { type: 'string', example: 'Installer helper tool' },
        password: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Upload an extra Windows .exe (password-protected)',
  })
  async uploadAsset(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadHeltyDesktopExternalExecutableDto,
    @Headers('x-helty-upload-password') headerPassword?: string,
  ) {
    if (!file?.path) {
      throw new BadRequestException('file is required');
    }
    this.heltyDesktop.assertUploadPassword(body?.password, headerPassword);
    return this.heltyDesktop.createExternalExecutableFromUpload(
      body.name,
      body.description,
      file.path,
    );
  }

  @Public()
  @Post('assets/:fileName/delete')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Delete an uploaded extra executable (same password as upload); removes DB row and installer files',
  })
  deleteAsset(
    @Param('fileName') fileName: string,
    @Body() body: DeleteHeltyDesktopDto,
    @Headers('x-helty-upload-password') headerPassword?: string,
  ) {
    return this.heltyDesktop.deleteExternalExecutable(
      fileName,
      body?.password,
      headerPassword,
    );
  }

  @Public()
  @Get('assets/download/:fileName')
  @ApiOperation({
    summary: 'Download a specific extra executable by stored filename',
  })
  async downloadAsset(
    @Param('fileName') fileName: string,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.heltyDesktop.pipeExternalExecutableDownloadToResponse(
      res,
      fileName,
      publicBaseUrl(req),
    );
  }

  @Public()
  @Post('releases/:version/delete')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: { type: 'string' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Delete a release (same password as upload); removes DB row and installer files',
  })
  deleteRelease(
    @Param('version') version: string,
    @Body() body: DeleteHeltyDesktopDto,
    @Headers('x-helty-upload-password') headerPassword?: string,
  ) {
    return this.heltyDesktop.deleteRelease(
      version,
      body?.password,
      headerPassword,
    );
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
  @Get('ui/assets/upload')
  @ApiOperation({ summary: 'Browser upload page for extra executables' })
  uploadAssetsPage(@Res() res: Response) {
    res.type('html').send(ASSET_UPLOAD_HTML);
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

const ASSET_UPLOAD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Helty Desktop — Upload extra exe</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c1222;
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
    <h1>Helty Desktop — Upload extra exe</h1>
    <p class="sub">Store an extra Windows <code>&lt;name&gt;.exe</code> for download.</p>
    <form id="f">
      <label for="name">File name</label>
      <input id="name" name="name" type="text" placeholder="e.g. helpertool.exe" required autocomplete="off" />
      <label for="description">Description (optional)</label>
      <input id="description" name="description" type="text" placeholder="e.g. Installer helper tool" autocomplete="off" />
      <label for="password">Upload password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" />
      <label for="file">Extra (.exe)</label>
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
      const name = document.getElementById('name').value.trim();
      const description = document.getElementById('description').value.trim();
      const password = document.getElementById('password').value;
      const fileInput = document.getElementById('file');
      const file = fileInput.files[0];
      if (!file) { status.textContent = 'Choose a file.'; status.className = 'status err'; return; }
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      fd.append('password', password);
      fd.append('file', file);
      status.className = 'status';
      status.textContent = 'Uploading…';
      barWrap.classList.add('active');
      bar.style.width = '0%';
      btn.disabled = true;
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '../assets/upload');
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
            status.textContent = 'Uploaded ' + (j.fileName || name) + '.';
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
    button.btn-danger {
      display: inline-block; padding: .45rem .75rem; border-radius: 8px;
      font-size: .82rem; font-weight: 600; cursor: pointer; border: none;
      margin-left: .5rem;
      background: linear-gradient(135deg, #f87171, #dc2626);
      color: #0f172a;
    }
    button.btn-danger:hover:not(:disabled) { opacity: .92; }
    button.btn-danger:disabled { opacity: .45; cursor: not-allowed; }
    .loading { color: var(--muted); padding: 1.5rem; }
    .err { color: #f87171; padding: 1rem; }
    #msg { margin-top: 1rem; font-size: .88rem; min-height: 1.25rem; }
  </style>
</head>
<body>
  <div class="shell">
    <h1>Helty Desktop — Downloads</h1>
    <p class="sub">Releases and extra executables for Windows. Delete requires the same upload password.</p>
    <div class="card" id="root"><div class="loading">Loading…</div></div>
    <div id="msg"></div>
  </div>
  <script>
    const root = document.getElementById('root');
    const msg = document.getElementById('msg');

    function esc(s) {
      if (s === undefined || s === null) return '';
      return String(s).replace(/</g, '').replace(/>/g, '');
    }

    function renderReleasesTable(rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return '<p class="loading">No releases yet. Upload a build from <a href="../ui/upload" style="color:#38bdf8">upload page</a>.</p>';
      }
      let html = '<table><thead><tr><th>Version</th><th>File</th><th>Published</th><th>Actions</th></tr></thead><tbody>';
      rows.forEach(function (row, i) {
        const rawV = row.version;
        const v = esc(row.version);
        const fn = esc(row.fileName || '');
        const d = row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
        const badge = i === 0 ? '<span class="badge">Latest</span> ' : '';
        html += '<tr><td>' + badge + v + '</td><td><code style="font-size:.8rem;opacity:.9">' + fn + '</code></td><td style="color:#94a3b8;font-size:.85rem">' + d + '</td>';
        html += '<td style="white-space:nowrap"><a class="btn" href="../download/version/' + encodeURIComponent(rawV) + '">Download</a>';
        html += '<button type="button" class="btn-danger" data-kind="release" data-del="' + encodeURIComponent(rawV) + '">Delete</button></td></tr>';
      });
      html += '</tbody></table>';
      return html;
    }

    function renderAssetsTable(rows) {
      if (!Array.isArray(rows) || rows.length === 0) {
        return '<p class="loading">No extra executables yet. Upload from <a href="../ui/assets/upload" style="color:#38bdf8">extra upload page</a>.</p>';
      }
      let html = '<table><thead><tr><th>File</th><th>Description</th><th>Published</th><th>Actions</th></tr></thead><tbody>';
      rows.forEach(function (row) {
        const rawFile = row.fileName;
        const fn = esc(row.fileName || '');
        const desc = esc(row.description || '');
        const d = row.createdAt ? new Date(row.createdAt).toLocaleString() : '';
        html += '<tr><td><code style="font-size:.8rem;opacity:.9">' + fn + '</code></td><td style="color:#94a3b8;font-size:.85rem">' + desc + '</td><td style="color:#94a3b8;font-size:.85rem">' + d + '</td>';
        html += '<td style="white-space:nowrap"><a class="btn" href="../assets/download/' + encodeURIComponent(rawFile) + '">Download</a>';
        html += '<button type="button" class="btn-danger" data-kind="asset" data-del="' + encodeURIComponent(rawFile) + '">Delete</button></td></tr>';
      });
      html += '</tbody></table>';
      return html;
    }

    function renderAll(releases, assets) {
      let html = '';
      html += '<div style="margin-bottom:1.25rem">';
      html += '<h3 style="margin:0 0 .75rem;color:#e2e8f0;font-size:1.05rem">Releases</h3>';
      html += renderReleasesTable(releases);
      html += '</div>';
      html += '<div>';
      html += '<h3 style="margin:0 0 .75rem;color:#e2e8f0;font-size:1.05rem">Extra executables</h3>';
      html += renderAssetsTable(assets);
      html += '</div>';
      return html;
    }

    function bindDeleteButtons(loadAll) {
      root.querySelectorAll('button.btn-danger[data-kind]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const kind = btn.getAttribute('data-kind') || '';
          const del = decodeURIComponent(btn.getAttribute('data-del') || '');
          const label = kind === 'asset' ? ('file ' + del) : ('version ' + del);
          if (!confirm('Delete ' + label + ' from the server? This removes the files and cannot be undone.')) return;
          const pwd = prompt('Upload password');
          if (pwd === null) return;
          btn.disabled = true;
          msg.textContent = '';
          msg.style.color = '';

          const endpoint =
            kind === 'asset'
              ? '../assets/' + encodeURIComponent(del) + '/delete'
              : '../releases/' + encodeURIComponent(del) + '/delete';

          fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pwd })
          })
            .then(function (r) {
              return r.json().then(function (j) {
                return { ok: r.ok, status: r.status, body: j };
              });
            })
            .then(function (res) {
              btn.disabled = false;
              if (res.ok) {
                msg.style.color = '#4ade80';
                msg.textContent = 'Deleted ' + del + '.';
                return loadAll();
              }
              msg.style.color = '#f87171';
              msg.textContent = (res.body && res.body.message) ? res.body.message : ('Delete failed (' + res.status + ')');
            })
            .catch(function () {
              btn.disabled = false;
              msg.style.color = '#f87171';
              msg.textContent = 'Network error';
            });
        });
      });
    }

    function loadAll() {
      root.innerHTML = '<div class="loading">Loading…</div>';
      msg.textContent = '';
      msg.style.color = '';
      return Promise.all([
        fetch('../releases').then(function (r) { return r.json(); }),
        fetch('../assets').then(function (r) { return r.json(); }),
      ])
        .then(function (arr) {
          const releases = arr[0];
          const assets = arr[1];
          root.innerHTML = renderAll(releases, assets);
          bindDeleteButtons(loadAll);
        });
    }

    loadAll()
      .catch(function () {
        root.innerHTML = '<div class="err">Could not load data.</div>';
      });
  </script>
</body>
</html>`;
