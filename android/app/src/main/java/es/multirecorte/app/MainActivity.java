package es.multirecorte.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.text.TextUtils;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.database.Cursor;

import java.io.OutputStream;
import java.util.Base64;

public class MainActivity extends Activity {
    private static final int PICK_IMAGE = 4711;
    private WebView webView;
    private ValueCallback<Uri[]> pendingFileChooser;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xFFF5F3EE);
        webView = new WebView(this);
        webView.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(0xFFF5F3EE);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setSupportZoom(false);
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pendingFileChooser != null) pendingFileChooser.onReceiveValue(null);
                pendingFileChooser = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Elige una fotografía"), PICK_IMAGE);
                    return true;
                } catch (Exception error) {
                    pendingFileChooser = null;
                    return false;
                }
            }
        });
        root.addView(webView);
        setContentView(root);
        if (savedInstanceState == null) webView.loadUrl("file:///android_asset/www/index.html");
        else webView.restoreState(savedInstanceState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_IMAGE || pendingFileChooser == null) return;
        Uri[] results = resultCode == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null;
        pendingFileChooser.onReceiveValue(results);
        pendingFileChooser = null;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        if (webView != null) webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private class AndroidBridge {
        @JavascriptInterface
        public void saveFile(String filename, String mimeType, String base64Data) {
            try {
                String safeName = filename == null ? "multirecorte.txt" : filename.replaceAll("[^a-zA-Z0-9._-]", "_");
                byte[] bytes = Base64.getDecoder().decode(base64Data);
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType == null ? "application/octet-stream" : mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Multirecorte");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("No se pudo crear el archivo en Descargas");
                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) throw new IllegalStateException("No se pudo abrir el archivo");
                    output.write(bytes);
                }
                ContentValues complete = new ContentValues();
                complete.put(MediaStore.MediaColumns.IS_PENDING, 0);
                getContentResolver().update(uri, complete, null, null);
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Guardado en Descargas/Multirecorte", Toast.LENGTH_LONG).show());
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Error al guardar: " + error.getMessage(), Toast.LENGTH_LONG).show());
            }
        }

        @JavascriptInterface
        public void printLog(String content) {
            runOnUiThread(() -> {
                try {
                    PrintManager printManager = (PrintManager) getSystemService(PRINT_SERVICE);
                    WebView printView = new WebView(MainActivity.this);
                    String escaped = TextUtils.htmlEncode(content == null ? "" : content);
                    String html = "<!doctype html><html><head><meta charset='utf-8'><style>body{font-family:monospace;padding:28px;color:#222}h2{font:700 18px sans-serif}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;line-height:1.5}</style></head><body><h2>Multirecorte · registro de diagnóstico</h2><pre>" + escaped + "</pre></body></html>";
                    printView.setWebViewClient(new WebViewClient() {
                        @Override public void onPageFinished(WebView view, String url) {
                            PrintAttributes attributes = new PrintAttributes.Builder()
                                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                    .setResolution(new PrintAttributes.Resolution("log", "Registro", 300, 300))
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .build();
                            printManager.print("Multirecorte - log", printView.createPrintDocumentAdapter("Multirecorte log"), attributes);
                        }
                    });
                    printView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "No se pudo abrir la impresión: " + error.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }
    }
}
