# SPREC-BTUCH

Aplicación web en Google Apps Script para registrar casos y procesar muestras SPREC del Biobanco de la Universidad de Chile.

## Estructura

- `index.html`: interfaz principal de la web app
- `server.js`: lógica backend de Apps Script y acceso a Google Sheets
- `appsscript.json`: manifiesto del proyecto
- `.clasp.json`: enlace local con el proyecto remoto de Apps Script
- `scripts/`: utilidades de respaldo y flujo operativo

## Requisitos

- `clasp` instalado y autenticado
- acceso al proyecto Apps Script asociado en `.clasp.json`
- Git configurado

## Flujo recomendado

Antes de editar:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-appscript.ps1
```

Si quieres traer lo último desde Apps Script sin sobrescribir trabajo a ciegas:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\safe-clasp-pull.ps1
```

Después de validar cambios locales:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\git-backup.ps1
git push
```

Si necesitas subir cambios a Apps Script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\safe-clasp-push.ps1
```

## Respaldos

Los snapshots locales quedan en:

```text
.\backups\appscript\
```

La guía detallada está en [`BACKUP.md`](./BACKUP.md).
