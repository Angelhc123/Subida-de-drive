# WspDrive Bot

Sube automáticamente todo lo que mandas a un grupo de WhatsApp a tu Google Drive.

---

## Configuración (una sola vez)

### Paso 1 — Google Cloud Console (5 min)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com) y crea un proyecto
2. En el menú lateral: **APIs y servicios → Biblioteca** → busca **Google Drive API** → Activar
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**
   - Tipo de aplicación: **Aplicación de escritorio**
   - Ponle cualquier nombre → Crear
4. Descarga el JSON o copia el **Client ID** y **Client Secret**
5. En **Pantalla de consentimiento OAuth** → agrega tu Gmail como usuario de prueba

### Paso 2 — Crear el .env

Copia `.env.example` a `.env` y pon tu Client ID y Client Secret:

```
GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
WA_GROUP_NAME=Nombre Exacto Del Grupo
```

### Paso 3 — Generar el Refresh Token (30 seg)

```bash
npm install
node setup.js
```

- Se abre un link en consola → ábrelo en el navegador
- Inicia sesión con tu Gmail → acepta permisos
- Copia el código → pégalo en la consola
- Te imprime el `GOOGLE_REFRESH_TOKEN` → cópialo a tu `.env`

### Paso 4 — Correr

```bash
npm start
```

Abre `http://localhost:3000` → escanea el QR → pega el link de tu carpeta de Drive → listo.

---

## Deploy en Railway

1. Sube el código a GitHub (sin `.env` ni `auth_info/`)
2. En Railway: New Project → Deploy from GitHub
3. Agrega las variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, `WA_GROUP_NAME`
4. Para que la sesión de WhatsApp persista → crea un **Volume** en Railway montado en `/app/auth_info`
5. Escanea el QR desde la URL pública de Railway

---

## Uso diario

- Manda cualquier archivo, foto, audio o video al grupo configurado
- Se sube solo a la carpeta de Drive
- Desde la interfaz web puedes cambiar la carpeta pegando el link de Drive en cualquier momento
