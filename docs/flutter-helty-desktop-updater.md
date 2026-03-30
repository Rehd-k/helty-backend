# Helty Desktop — Flutter (Windows) updater integration

This backend hosts Windows `.exe` builds for the **Helty** desktop app, with a password-protected upload flow and public JSON + download URLs suitable for packages like **[updat](https://pub.dev/packages/updat)** (or any custom checker that needs a version string and a download URL).

Base path (no global API prefix in this Nest app): **`/helty-desktop`**.

Replace `https://your-api.example.com` with your real origin (and port in dev, e.g. `http://localhost:4000`).

---

## Environment (backend)

| Variable | Purpose |
|----------|---------|
| `HELITY_DESKTOP_UPLOAD_PASSWORD` | Password required to upload a new build. Defaults to `vesselinc` if unset. **Set a strong value in production.** |

Files are stored under `uploads/helty-desktop/` on the server (gitignored). Each release is saved as **`helty{version}.exe`** (with a filesystem-safe version segment). Metadata is in Postgres (`HeltyDesktopRelease`).

---

## Public API (for Flutter / CI)

### Latest version (JSON)

`GET /helty-desktop/update/latest`

**200**

```json
{
  "version": "1.4.0"
}
```

**404** — no release uploaded yet.

### Manifest (version + download URL)

`GET /helty-desktop/update/manifest`

**200**

```json
{
  "version": "1.4.0",
  "downloadUrl": "https://your-api.example.com/helty-desktop/download/latest",
  "fileName": "helty1.4.0.exe"
}
```

Use `downloadUrl` as the binary URL for updaters. It always points at the **latest** uploaded build.

### List releases

`GET /helty-desktop/releases`

Returns an array of `{ id, version, fileName, createdAt }`, newest first.

### Extra executables (filename + description)
Upload additional `.exe` files (helpers, dependencies, etc.) and download them by `fileName`.

#### List extra executables
`GET /helty-desktop/assets`

Returns an array of `{ id, fileName, description, createdAt }`, newest first.

#### Upload extra executable (password-protected)
`POST /helty-desktop/assets/upload`

`multipart/form-data` with fields:
- `name` (string; can be `tool` or `tool.exe`)
- `description` (string; optional)
- `password` (string; required) or send header `x-helty-upload-password`
- `file` (the `.exe` binary)

#### Download extra executable
`GET /helty-desktop/assets/download/{fileName}`

Streams the `.exe` file.

#### Delete extra executable (password-protected)
`POST /helty-desktop/assets/{fileName}/delete`

JSON body: `{ "password": "..." }` (or header `x-helty-upload-password`).

### Download installer

- Latest: `GET /helty-desktop/download/latest` — streams the `.exe` (`Content-Disposition: attachment`, `Content-Type: application/octet-stream`).
- Specific version: `GET /helty-desktop/download/version/{version}` — `{version}` is the exact string stored in the DB (e.g. `1.4.0`).

Responses include headers:

- `X-Helty-Version` — release version
- `X-Helty-Download-Url` — canonical latest download URL (same as manifest)

---

## Browser UI (manual)

| Page | URL |
|------|-----|
| Upload (password, version, file, **upload progress bar**) | `GET /helty-desktop/ui/upload` |
| Upload extra executables (name, description, password, file, **upload progress bar**) | `GET /helty-desktop/ui/assets/upload` |
| Downloads table (list + **Download** per version) | `GET /helty-desktop/ui/downloads` |

Upload: `POST /helty-desktop/upload` — `multipart/form-data` with fields `version`, `password`, and `file` (`.exe` only). Alternatively, send header `x-helty-upload-password` instead of `password`.

---

## Flutter: `updat` package (example)

Use semantic versions in your app (`pubspec.yaml` / `package_info_plus`) and compare with the server’s latest string.

```dart
import 'package:http/http.dart' as http;
import 'package:updat/updat.dart';

final Uri _base = Uri.parse('https://your-api.example.com/helty-desktop');

Future<void> checkHeltyDesktopUpdate() async {
  await updat(
    getLatestVersion: () async {
      final r = await http.get(_base.resolve('update/latest'));
      if (r.statusCode != 200) {
        throw Exception('Version check failed: ${r.statusCode}');
      }
      final map = jsonDecode(r.body) as Map<String, dynamic>;
      return map['version'] as String;
    },
    getBinaryUrl: (version) async {
      // Latest installer URL (same for any newer version you publish)
      return _base.resolve('download/latest').toString();
    },
    currentVersion: '1.3.0', // from package_info_plus / your constant
    appName: 'Helty',
  );
}
```

Adjust `currentVersion` to your real runtime version. If you prefer a single HTTP call to get both fields, use `GET /helty-desktop/update/manifest` and parse `version` + `downloadUrl` instead of `getLatestVersion` + `getBinaryUrl`.

**CORS:** The Nest app enables CORS broadly (`enableCors({})`). If you tighten CORS later, allow your Flutter app’s origin for these routes.

**HTTPS:** Use HTTPS in production so downloads and version checks are not tampered with.

---

## Swagger

Open **`/api`** and look for the tag **Helty Desktop (Flutter Windows)**.
