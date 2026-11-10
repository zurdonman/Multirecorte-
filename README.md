# Multirecorte

Aplicación en español para dividir una fotografía en piezas de mosaico, seleccionar varios recortes a la vez y exportarlos juntos. Incluye versión web instalable (PWA) y proyecto Android nativo contenedor para generar un APK.

## Funciones

- Importa JPG, PNG y WebP; la imagen se procesa en el dispositivo y no se envía a ningún servidor.
- Plantillas de 2×2, 3×3, 4×3 y 4×4; cuadrícula configurable de 1 a 12 filas y columnas (hasta 144 piezas).
- Toca las piezas en la vista previa para incluirlas/excluirlas, o selecciona y quita todas de una vez.
- Guarda hasta 12 plantillas propias en el dispositivo.
- Exporta las piezas PNG seleccionadas en un solo ZIP. Los nombres indican fila y columna.
- El botón **Imprimir log** abre el diálogo de impresión del sistema Android; **↓** guarda el registro `.txt` en `Descargas/Multirecorte`. El registro recoge errores JavaScript y acciones de la app, no el contenido de la fotografía.
- Funciona sin conexión después de la primera carga en la versión web.

## Probar la aplicación web

Sirve la carpeta raíz mediante un servidor HTTP (el modo PWA necesita HTTP/HTTPS):

```bash
python3 -m http.server 8080
```

Abre `http://localhost:8080`. También se puede desplegar como sitio estático HTTPS e instalar desde el navegador Android.

## Crear el APK Android

El proyecto está en `android/`. Requisitos para compilar localmente: JDK 17, Android SDK API 35 y Gradle 8.9.

```bash
cd android
gradle --no-daemon :app:assembleDebug
```

El APK de depuración se genera en `android/app/build/outputs/apk/debug/app-debug.apk`. La tarea Gradle sincroniza automáticamente `index.html`, estilos y lógica web dentro de los assets antes de compilar. Instálalo con Android Studio o `adb install -r app/build/outputs/apk/debug/app-debug.apk`.

También hay un flujo de GitHub Actions (`Construir APK Android`) que compila el APK en cada push a esta rama. Descarga `Multirecorte-debug-APK` en **Actions → ejecución del flujo → Artifacts**. Este APK es de depuración, no está firmado para publicar en Play Store.

## Notas

- Android 10 o posterior (API 29+) para guardar sin permisos especiales en `Descargas/Multirecorte`.
- La foto original permanece en la memoria local; la app no tiene permiso de Internet ni permisos generales de almacenamiento.
- El formato ZIP usa compresión sin pérdida tipo «store»; conserva la calidad PNG original de cada recorte.
