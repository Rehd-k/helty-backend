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
import { generateSafeNanoid } from '../../common/utils/human-readable-id.util';
import type { Response } from 'express';
import type { Request } from 'express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators';
import { ImshAndroidService } from './imsh-android.service';
import { UploadImshAndroidDto } from './dto/upload-imsh-android.dto';
import { DeleteImshAndroidDto } from './dto/delete-imsh-android.dto';
import { InitChunkedUploadDto } from './dto/init-chunked-upload.dto';

const TMP_DIR = path.join(process.cwd(), 'uploads', 'imsh-android', 'tmp');
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      cb(null, TMP_DIR);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${generateSafeNanoid()}.upload`);
    },
  }),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.apk') {
      return cb(
        new BadRequestException('Only Android .apk packages are allowed'),
        false,
      );
    }
    cb(null, true);
  },
});

const chunkInterceptor = FileInterceptor('chunk', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(TMP_DIR, { recursive: true });
      cb(null, TMP_DIR);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${generateSafeNanoid()}.chunk`);
    },
  }),
  limits: { fileSize: MAX_CHUNK_BYTES },
});

function publicBaseUrl(req: Request): string {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || req.protocol;
  const host = req.get('host') || 'localhost';
  return `${proto}://${host}`;
}

@ApiTags('IMSH Android (Flutter patient app)')
@Controller('imsh-android')
export class ImshAndroidController {
  constructor(private readonly imshAndroid: ImshAndroidService) {}

  @Public()
  @Get('update/latest')
  @ApiOperation({
    summary: 'Latest version string (for updater / Flutter)',
  })
  async latestVersion() {
    return this.imshAndroid.getLatestVersionJson();
  }

  @Public()
  @Get('update/manifest')
  @ApiOperation({
    summary: 'Version + absolute download URL (convenience for Flutter)',
  })
  manifest(@Req() req: Request) {
    return this.imshAndroid.getManifest(publicBaseUrl(req));
  }

  @Public()
  @Get('releases')
  @ApiOperation({ summary: 'List all published releases' })
  list() {
    return this.imshAndroid.listReleases();
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
      'Delete a release (same password as upload); removes DB row and APK files',
  })
  deleteRelease(
    @Param('version') version: string,
    @Body() body: DeleteImshAndroidDto,
    @Headers('x-imsh-upload-password') headerPassword?: string,
  ) {
    return this.imshAndroid.deleteRelease(
      version,
      body?.password,
      headerPassword,
    );
  }

  @Public()
  @Get('download/latest')
  @ApiOperation({ summary: 'Download the latest .apk package' })
  async downloadLatest(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    await this.imshAndroid.pipeDownloadToResponse(
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
    await this.imshAndroid.pipeDownloadToResponse(
      res,
      version,
      publicBaseUrl(req),
    );
  }

  @Public()
  @Post('upload/init')
  @ApiOperation({
    summary:
      'Start a chunked upload session (recommended for large .apk over slow networks)',
  })
  async initChunkedUpload(
    @Body() body: InitChunkedUploadDto,
    @Headers('x-imsh-upload-password') headerPassword?: string,
  ) {
    this.imshAndroid.assertUploadPassword(body?.password, headerPassword);
    return this.imshAndroid.initChunkedUpload({
      kind: body.kind,
      version: body.version,
      totalBytes: body.totalBytes,
      chunkSize: body.chunkSize,
    });
  }

  @Public()
  @Get('upload/:uploadId/status')
  @ApiOperation({ summary: 'Chunked upload progress (which chunks arrived)' })
  chunkedUploadStatus(@Param('uploadId') uploadId: string) {
    return this.imshAndroid.getChunkedUploadStatus(uploadId);
  }

  @Public()
  @Post('upload/:uploadId/chunk/:index')
  @UseInterceptors(chunkInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['chunk'],
      properties: {
        chunk: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload one chunk (retries are safe)' })
  async uploadChunk(
    @Param('uploadId') uploadId: string,
    @Param('index') indexRaw: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file?.path) {
      throw new BadRequestException('chunk is required');
    }
    const index = Number(indexRaw);
    if (!Number.isInteger(index)) {
      throw new BadRequestException('index must be an integer');
    }
    return this.imshAndroid.saveChunk(uploadId, index, file.path);
  }

  @Public()
  @Post('upload/:uploadId/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assemble chunks and publish release',
  })
  async completeChunkedUpload(@Param('uploadId') uploadId: string) {
    return this.imshAndroid.completeChunkedRelease(uploadId);
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
        version: { type: 'string', example: '0.1.1' },
        password: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary:
      'Upload a new Android .apk in one request (fine on LAN; prefer chunked upload on slow links)',
  })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadImshAndroidDto,
    @Headers('x-imsh-upload-password') headerPassword?: string,
  ) {
    if (!file?.path) {
      throw new BadRequestException('file is required');
    }
    this.imshAndroid.assertUploadPassword(body?.password, headerPassword);
    return this.imshAndroid.createReleaseFromUpload(body.version, file.path);
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
  <title>IMSH Android — Upload APK</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c1222;
      --card: #151d2e;
      --accent: #34d399;
      --accent2: #38bdf8;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      font-family: 'DM Sans', system-ui, sans-serif;
      background: radial-gradient(ellipse 120% 80% at 50% -20%, #14532d 0%, var(--bg) 55%);
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
      background: linear-gradient(135deg, var(--accent), #059669);
      color: #0f172a;
      transition: transform .15s, box-shadow .15s;
    }
    button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 25px -5px rgba(52,211,153,.4); }
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
    <h1>IMSH Android — Upload</h1>
    <p class="sub">Publish a new patient app build. Large files upload in chunks with automatic retries. Stored as <code>imsh{version}.apk</code>. Sign with the same keystore as installed apps.</p>
    <form id="f">
      <label for="version">Version</label>
      <input id="version" name="version" type="text" placeholder="e.g. 0.1.1" required autocomplete="off" />
      <label for="password">Upload password</label>
      <input id="password" name="password" type="password" required autocomplete="current-password" />
      <label for="file">Package (.apk)</label>
      <input id="file" name="file" type="file" accept=".apk,application/vnd.android.package-archive" required />
      <button type="submit" id="btn">Upload</button>
    </form>
    <div class="bar-wrap" id="barWrap"><div class="bar" id="bar"></div></div>
    <div class="status" id="status"></div>
  </div>
  <script>
    const CHUNK_SIZE = 2 * 1024 * 1024;
    const MAX_RETRIES = 6;
    const f = document.getElementById('f');
    const bar = document.getElementById('bar');
    const barWrap = document.getElementById('barWrap');
    const status = document.getElementById('status');
    const btn = document.getElementById('btn');

    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    function xhrJson(method, url, body, isForm) {
      return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.onload = function () {
          var j = {};
          try { j = JSON.parse(xhr.responseText || '{}'); } catch (e) {}
          if (xhr.status >= 200 && xhr.status < 300) resolve(j);
          else reject(new Error(j.message || xhr.statusText || ('HTTP ' + xhr.status)));
        };
        xhr.onerror = function () { reject(new Error('Network error')); };
        if (isForm) xhr.send(body);
        else {
          xhr.setRequestHeader('Content-Type', 'application/json');
          xhr.send(JSON.stringify(body || {}));
        }
      });
    }

    async function putChunk(uploadId, index, blob) {
      var attempt = 0;
      while (true) {
        attempt++;
        try {
          var fd = new FormData();
          fd.append('chunk', blob, 'chunk-' + index + '.bin');
          return await xhrJson('POST', '../upload/' + encodeURIComponent(uploadId) + '/chunk/' + index, fd, true);
        } catch (err) {
          if (attempt >= MAX_RETRIES) throw err;
          status.textContent = 'Chunk ' + (index + 1) + ' failed (' + (err.message || 'error') + '), retry ' + attempt + '…';
          await sleep(Math.min(15000, 500 * Math.pow(2, attempt - 1)));
        }
      }
    }

    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      const version = document.getElementById('version').value.trim();
      const password = document.getElementById('password').value;
      const file = document.getElementById('file').files[0];
      if (!file) { status.textContent = 'Choose a file.'; status.className = 'status err'; return; }
      if (!/\\.apk$/i.test(file.name)) { status.textContent = 'Only .apk files are allowed.'; status.className = 'status err'; return; }

      status.className = 'status';
      status.textContent = 'Starting chunked upload…';
      barWrap.classList.add('active');
      bar.style.width = '0%';
      btn.disabled = true;

      try {
        const init = await xhrJson('POST', '../upload/init', {
          password: password,
          kind: 'release',
          version: version,
          totalBytes: file.size,
          chunkSize: CHUNK_SIZE
        });
        const uploadId = init.uploadId;
        const chunkSize = init.chunkSize || CHUNK_SIZE;
        const totalChunks = init.totalChunks;
        var uploadedBytes = 0;

        for (var i = 0; i < totalChunks; i++) {
          var start = i * chunkSize;
          var end = Math.min(file.size, start + chunkSize);
          var blob = file.slice(start, end);
          status.textContent = 'Uploading chunk ' + (i + 1) + ' / ' + totalChunks + '…';
          await putChunk(uploadId, i, blob);
          uploadedBytes = end;
          bar.style.width = Math.round((uploadedBytes / file.size) * 100) + '%';
        }

        status.textContent = 'Assembling & publishing…';
        const done = await xhrJson('POST', '../upload/' + encodeURIComponent(uploadId) + '/complete', {});
        status.className = 'status ok';
        status.textContent = 'Published ' + (done.version || version) + ' — ' + (done.fileName || '');
      } catch (err) {
        status.className = 'status err';
        status.textContent = (err && err.message) ? err.message : 'Upload failed';
      } finally {
        btn.disabled = false;
        barWrap.classList.remove('active');
      }
    });
  </script>
</body>
</html>`;

const DOWNLOADS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IMSH Android — Downloads</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c1222;
      --card: #151d2e;
      --accent: #34d399;
      --accent2: #38bdf8;
      --text: #e2e8f0;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0; min-height: 100vh;
      font-family: 'DM Sans', system-ui, sans-serif;
      background: radial-gradient(ellipse 120% 80% at 50% -20%, #14532d 0%, var(--bg) 55%);
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
      background: rgba(52,211,153,.15); color: var(--accent);
    }
    a.btn {
      display: inline-block; padding: .45rem .85rem; border-radius: 8px;
      font-size: .85rem; font-weight: 600; text-decoration: none;
      background: linear-gradient(135deg, var(--accent), #059669);
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
    <h1>IMSH Android — Downloads</h1>
    <p class="sub">Published patient app APKs. Delete requires the same upload password.</p>
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
        return '<p class="loading">No releases yet. Upload a build from <a href="../ui/upload" style="color:#34d399">upload page</a>.</p>';
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
        html += '<button type="button" class="btn-danger" data-del="' + encodeURIComponent(rawV) + '">Delete</button></td></tr>';
      });
      html += '</tbody></table>';
      return html;
    }

    function bindDeleteButtons(loadAll) {
      root.querySelectorAll('button.btn-danger[data-del]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const del = decodeURIComponent(btn.getAttribute('data-del') || '');
          if (!confirm('Delete version ' + del + ' from the server? This removes the APK and cannot be undone.')) return;
          const pwd = prompt('Upload password');
          if (pwd === null) return;
          btn.disabled = true;
          msg.textContent = '';
          msg.style.color = '';

          fetch('../releases/' + encodeURIComponent(del) + '/delete', {
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
      return fetch('../releases')
        .then(function (r) { return r.json(); })
        .then(function (releases) {
          root.innerHTML = renderReleasesTable(releases);
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
