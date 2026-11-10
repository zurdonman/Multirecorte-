(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('previewCanvas');
  const ctx = canvas.getContext('2d');
  const state = { image: null, imageName: '', cols: 3, rows: 3, selected: new Set(), log: [], toastTimer: null, installPrompt: null };
  const MAX_SIDE = 2400;

  function logEvent(message, details = {}) {
    const entry = { time: new Date().toISOString(), event: message, ...details };
    state.log.push(entry);
    if (state.log.length > 500) state.log.shift();
    try { localStorage.setItem('multirecorte-last-log', JSON.stringify(state.log.slice(-100))); } catch (_) {}
    console.info('[Multirecorte]', message, details);
  }
  function showToast(message) {
    const toast = $('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }
  function getAndroidBridge() { return window.AndroidBridge || null; }
  function safeFilename(name) { return String(name || 'foto').replace(/\.[^.]+$/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50) || 'foto'; }
  function updateSelectionUI() {
    const total = state.cols * state.rows, selected = state.selected.size;
    $('selectionCount').textContent = `${selected} ${selected === 1 ? 'seleccionada' : 'seleccionadas'}`;
    $('pieceSummary').textContent = `${total} ${total === 1 ? 'pieza' : 'piezas'} en total`;
    $('selectAll').textContent = selected === total ? 'Quitar todas' : 'Seleccionar todas';
    $('exportBtn').disabled = !state.image || selected === 0;
    $('exportHint').textContent = !state.image ? 'Selecciona una fotografía primero' : selected === 0 ? 'Selecciona al menos una pieza' : `${selected} ${selected === 1 ? 'pieza lista' : 'piezas listas'} · ZIP`;
    drawPreview();
  }
  function drawPreview() {
    if (!state.image) return;
    const image = state.image;
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const cw = canvas.width / state.cols, ch = canvas.height / state.rows;
    for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
      const index = r * state.cols + c;
      const x = c * cw, y = r * ch;
      if (state.selected.has(index)) {
        ctx.fillStyle = 'rgba(228, 112, 57, .17)'; ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = '#fffaf4'; ctx.lineWidth = Math.max(2, Math.min(canvas.width, canvas.height) / 260); ctx.strokeRect(x, y, cw, ch);
        if (cw > 38 && ch > 38) {
          const radius = Math.max(8, Math.min(cw, ch) * .055);
          ctx.beginPath(); ctx.arc(x + cw - radius * 1.5, y + radius * 1.5, radius, 0, Math.PI * 2); ctx.fillStyle = '#e77742'; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x + cw - radius * 1.95, y + radius * 1.5); ctx.lineTo(x + cw - radius * 1.62, y + radius * 1.82); ctx.lineTo(x + cw - radius * 1.02, y + radius * 1.15); ctx.stroke();
        }
      } else {
        ctx.fillStyle = 'rgba(25, 30, 24, .40)'; ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = Math.max(1.5, Math.min(canvas.width, canvas.height) / 320); ctx.strokeRect(x, y, cw, ch);
      }
    }
  }
  function setGrid(cols, rows, source = 'manual') {
    cols = Math.max(1, Math.min(12, Math.round(Number(cols) || 1)));
    rows = Math.max(1, Math.min(12, Math.round(Number(rows) || 1)));
    state.cols = cols; state.rows = rows;
    $('colsInput').value = cols; $('rowsInput').value = rows;
    state.selected = new Set(Array.from({ length: cols * rows }, (_, i) => i));
    document.querySelectorAll('.template-card').forEach(card => card.classList.toggle('active', Number(card.dataset.cols) === cols && Number(card.dataset.rows) === rows));
    logEvent('Cuadrícula actualizada', { columnas: cols, filas: rows, piezas: cols * rows, origen: source });
    updateSelectionUI();
  }
  function displayImage(file) {
    if (!file || !file.type.startsWith('image/')) { showToast('Elige un archivo de imagen válido.'); logEvent('Archivo rechazado', { tipo: file?.type || 'desconocido' }); return; }
    if (file.size > 100 * 1024 * 1024) { showToast('La imagen supera el límite de 100 MB.'); return; }
    const url = URL.createObjectURL(file), image = new Image();
    image.onload = () => {
      if (state.image?._objectURL) URL.revokeObjectURL(state.image._objectURL);
      image._objectURL = url; state.image = image; state.imageName = file.name || 'fotografia';
      canvas.hidden = false; $('emptyState').hidden = true; $('canvasHint').hidden = false;
      $('imageMeta').hidden = false; $('metaName').textContent = state.imageName; $('metaDimensions').textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
      $('metaThumb').style.backgroundImage = `url("${url}")`;
      $('fileSizeLabel').textContent = `${formatBytes(file.size)} · ${image.naturalWidth} × ${image.naturalHeight} px`;
      $('uploadTitle').textContent = 'Cambiar fotografía'; $('uploadHint').textContent = 'Toca para elegir otra imagen';
      state.selected = new Set(Array.from({ length: state.cols * state.rows }, (_, i) => i));
      logEvent('Fotografía cargada', { nombre: state.imageName, tipo: file.type, bytes: file.size, ancho: image.naturalWidth, alto: image.naturalHeight });
      updateSelectionUI();
    };
    image.onerror = () => { URL.revokeObjectURL(url); showToast('No se pudo abrir esta imagen.'); logEvent('Error al cargar fotografía', { nombre: file.name, tipo: file.type }); };
    image.src = url;
  }
  function formatBytes(bytes) { if (!bytes) return '0 B'; const units = ['B','KB','MB','GB']; const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3); return `${(bytes / (1024 ** i)).toFixed(i ? 1 : 0)} ${units[i]}`; }
  function blobToBase64(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); }); }
  async function saveBlob(blob, filename, mime = blob.type || 'application/octet-stream') {
    const bridge = getAndroidBridge();
    if (bridge?.saveFile) {
      try { bridge.saveFile(filename, mime, await blobToBase64(blob)); logEvent('Archivo guardado en Descargas', { nombre: filename, bytes: blob.size }); return true; }
      catch (e) { logEvent('Error guardando archivo nativo', { error: String(e) }); showToast('No se pudo guardar en Descargas.'); return false; }
    }
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); return true;
  }
  function crc32(bytes) {
    if (!crc32.table) { crc32.table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc32.table[n] = c >>> 0; } }
    let crc = 0xffffffff; for (const b of bytes) crc = crc32.table[(crc ^ b) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0;
  }
  function zipBlobs(files) {
    const enc = new TextEncoder(), local = [], central = []; let offset = 0;
    const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    for (const file of files) {
      const name = enc.encode(file.name), data = file.data, crc = crc32(data), localHeader = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name]);
      local.push(localHeader, data);
      const centralHeader = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name]);
      central.push(centralHeader); offset += localHeader.length + data.length;
    }
    const centralSize = central.reduce((sum, p) => sum + p.length, 0), count = files.length;
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count), ...u16(count), ...u32(centralSize), ...u32(offset), ...u16(0)]);
    return new Blob([...local, ...central, end], { type: 'application/zip' });
  }
  function canvasBlob(cropCanvas) { return new Promise((resolve, reject) => cropCanvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo generar el PNG')), 'image/png')); }
  async function exportPieces() {
    if (!state.image || !state.selected.size) return;
    const button = $('exportBtn'); button.disabled = true; $('exportHint').textContent = 'Preparando tus recortes…';
    logEvent('Exportación iniciada', { seleccionadas: state.selected.size, columnas: state.cols, filas: state.rows });
    try {
      const image = state.image, files = [], base = safeFilename(state.imageName);
      const indices = [...state.selected].sort((a, b) => a - b);
      for (let n = 0; n < indices.length; n++) {
        const index = indices[n], row = Math.floor(index / state.cols), col = index % state.cols;
        const x = Math.round(col * image.naturalWidth / state.cols), y = Math.round(row * image.naturalHeight / state.rows);
        const right = Math.round((col + 1) * image.naturalWidth / state.cols), bottom = Math.round((row + 1) * image.naturalHeight / state.rows);
        const piece = document.createElement('canvas'); piece.width = right - x; piece.height = bottom - y;
        piece.getContext('2d').drawImage(image, x, y, piece.width, piece.height, 0, 0, piece.width, piece.height);
        const blob = await canvasBlob(piece); files.push({ name: `${base}_pieza_${String(row + 1).padStart(2, '0')}_${String(col + 1).padStart(2, '0')}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
        if (n % 8 === 0) $('exportHint').textContent = `Preparando pieza ${n + 1} de ${indices.length}…`;
      }
      const zip = zipBlobs(files), filename = `${base}_recortes_${new Date().toISOString().slice(0, 10)}.zip`;
      if (await saveBlob(zip, filename, 'application/zip')) { showToast(`${files.length} ${files.length === 1 ? 'pieza guardada' : 'piezas guardadas'} en un ZIP.`); logEvent('Exportación completada', { archivos: files.length, zipBytes: zip.size, nombre: filename }); }
    } catch (error) { logEvent('Error de exportación', { error: String(error), stack: error?.stack || '' }); showToast('Hubo un problema al exportar. Prueba con menos piezas.'); }
    finally { button.disabled = false; updateSelectionUI(); }
  }
  function getLogText() {
    const header = [`MULTIRECORTE · REGISTRO DE DIAGNÓSTICO`, `Generado: ${new Date().toISOString()}`, `Versión: 1.0.0`, `Plataforma: ${navigator.userAgent}`, `Idioma: ${navigator.language}`, `Online: ${navigator.onLine ? 'sí' : 'no'}`, `Registros: ${state.log.length}`, '─'.repeat(72)];
    return [...header, ...state.log.map(e => `${e.time}  ${e.event}${Object.keys(e).filter(k => !['time','event'].includes(k)).length ? '  ' + JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => !['time','event'].includes(k)))) : ''}`)].join('\n');
  }
  async function saveLog() {
    const filename = `multirecorte_log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    const ok = await saveBlob(new Blob([getLogText()], { type: 'text/plain;charset=utf-8' }), filename, 'text/plain');
    if (ok) showToast(getAndroidBridge() ? 'Log guardado en Descargas / Multirecorte.' : 'Log descargado. En Android estará en Descargas.');
  }
  function printLog() {
    const text = getLogText(), bridge = getAndroidBridge();
    try { if (bridge?.printLog) { bridge.printLog(text); logEvent('Solicitud de impresión del log'); return; } } catch (e) { logEvent('Error al imprimir log', { error: String(e) }); }
    const win = window.open('', '_blank');
    if (!win) { showToast('Permite las ventanas emergentes para imprimir el log.'); return; }
    const pre = win.document.createElement('pre'); pre.textContent = text; pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font:12px monospace;padding:24px;color:#222';
    win.document.title = 'Log Multirecorte'; win.document.body.appendChild(pre); win.focus(); setTimeout(() => win.print(), 300); logEvent('Solicitud de impresión del log');
  }
  function persistTemplates() { try { return JSON.parse(localStorage.getItem('multirecorte-templates') || '[]'); } catch (_) { return []; } }
  function renderSavedTemplates() {
    const box = $('savedTemplates'); box.replaceChildren();
    persistTemplates().forEach((tpl, index) => { const b = document.createElement('button'); b.className = 'saved-chip'; b.textContent = `${tpl.name} · ${tpl.cols}×${tpl.rows}  ×`; b.title = 'Toca para aplicar; mantén pulsado para eliminar'; b.addEventListener('click', () => { if (b.dataset.delete === 'yes') return; setGrid(tpl.cols, tpl.rows, 'plantilla guardada'); showToast(`Plantilla «${tpl.name}» aplicada.`); }); b.addEventListener('contextmenu', e => { e.preventDefault(); removeTemplate(index); }); let timer; b.addEventListener('touchstart', () => { timer = setTimeout(() => { b.dataset.delete = 'yes'; removeTemplate(index); }, 700); }, { passive: true }); b.addEventListener('touchend', () => clearTimeout(timer)); box.appendChild(b); });
  }
  function removeTemplate(index) { const all = persistTemplates(); all.splice(index, 1); localStorage.setItem('multirecorte-templates', JSON.stringify(all)); renderSavedTemplates(); showToast('Plantilla eliminada.'); }

  $('imageInput').addEventListener('change', e => { displayImage(e.target.files?.[0]); e.target.value = ''; });
  $('emptyUpload').addEventListener('click', () => $('imageInput').click());
  $('removeImage').addEventListener('click', () => { if (state.image?._objectURL) URL.revokeObjectURL(state.image._objectURL); state.image = null; state.imageName = ''; canvas.hidden = true; $('emptyState').hidden = false; $('canvasHint').hidden = true; $('imageMeta').hidden = true; $('fileSizeLabel').textContent = 'Sin imagen cargada'; $('uploadTitle').textContent = 'Elige una fotografía'; $('uploadHint').textContent = 'o arrástrala aquí · JPG, PNG, WEBP'; logEvent('Fotografía retirada'); updateSelectionUI(); });
  $('uploadZone').addEventListener('dragover', e => { e.preventDefault(); $('uploadZone').classList.add('dragover'); });
  $('uploadZone').addEventListener('dragleave', () => $('uploadZone').classList.remove('dragover'));
  $('uploadZone').addEventListener('drop', e => { e.preventDefault(); $('uploadZone').classList.remove('dragover'); displayImage(e.dataTransfer.files?.[0]); });
  document.querySelectorAll('.template-card').forEach(card => card.addEventListener('click', () => setGrid(card.dataset.cols, card.dataset.rows, 'plantilla predefinida')));
  $('colsInput').addEventListener('change', () => setGrid($('colsInput').value, state.rows)); $('rowsInput').addEventListener('change', () => setGrid(state.cols, $('rowsInput').value));
  document.querySelectorAll('[data-step]').forEach(btn => btn.addEventListener('click', () => { const key = btn.dataset.step, input = $(key === 'cols' ? 'colsInput' : 'rowsInput'); setGrid(key === 'cols' ? Number(input.value) + Number(btn.dataset.delta) : state.cols, key === 'rows' ? Number(input.value) + Number(btn.dataset.delta) : state.rows); }));
  $('saveTemplate').addEventListener('click', () => { const name = $('templateName').value.trim(); if (!name) { showToast('Escribe un nombre para la plantilla.'); $('templateName').focus(); return; } const all = persistTemplates(); if (all.length >= 12) { showToast('Puedes guardar hasta 12 plantillas.'); return; } all.push({ name, cols: state.cols, rows: state.rows }); localStorage.setItem('multirecorte-templates', JSON.stringify(all)); $('templateName').value = ''; renderSavedTemplates(); logEvent('Plantilla guardada', { nombre: name, columnas: state.cols, filas: state.rows }); showToast('Plantilla guardada en este dispositivo.'); });
  $('selectAll').addEventListener('click', () => { state.selected = state.selected.size === state.cols * state.rows ? new Set() : new Set(Array.from({ length: state.cols * state.rows }, (_, i) => i)); logEvent('Selección modificada', { seleccionadas: state.selected.size }); updateSelectionUI(); });
  canvas.addEventListener('click', e => { if (!state.image) return; const rect = canvas.getBoundingClientRect(), x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height; const col = Math.min(state.cols - 1, Math.max(0, Math.floor(x * state.cols))), row = Math.min(state.rows - 1, Math.max(0, Math.floor(y * state.rows))), index = row * state.cols + col; if (state.selected.has(index)) state.selected.delete(index); else state.selected.add(index); logEvent('Pieza seleccionada', { fila: row + 1, columna: col + 1, incluida: state.selected.has(index), seleccionadas: state.selected.size }); updateSelectionUI(); });
  $('exportBtn').addEventListener('click', exportPieces);
  $('undoSelection').addEventListener('click', () => { if (!state.image) { showToast('Primero añade una fotografía.'); return; } state.selected = new Set(Array.from({ length: state.cols * state.rows }, (_, i) => i)); logEvent('Selección restablecida'); updateSelectionUI(); });
  $('zoomBtn').addEventListener('click', () => { $('canvasStage').scrollIntoView({ behavior: 'smooth', block: 'center' }); showToast('Vista ajustada a la imagen.'); });
  $('saveLogBtn').addEventListener('click', saveLog); $('printLogBtn').addEventListener('click', printLog);
  $('helpBtn').addEventListener('click', () => $('helpDialog').showModal()); $('closeHelp').addEventListener('click', () => $('helpDialog').close()); $('gotIt').addEventListener('click', () => $('helpDialog').close());
  window.addEventListener('error', e => logEvent('Error JavaScript', { mensaje: e.message, archivo: e.filename, linea: e.lineno }));
  window.addEventListener('unhandledrejection', e => logEvent('Promesa rechazada', { error: String(e.reason) }));
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installPrompt = e; $('installBtn').hidden = false; });
  $('installBtn').addEventListener('click', async () => { if (!state.installPrompt) return; state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt = null; $('installBtn').hidden = true; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(err => logEvent('Service worker no disponible', { error: String(err) }));
  try { const old = JSON.parse(localStorage.getItem('multirecorte-last-log') || '[]'); if (Array.isArray(old)) state.log = old; } catch (_) {}
  logEvent('Aplicación iniciada', { version: '1.0.0', plataforma: getAndroidBridge() ? 'Android APK' : 'Web', idioma: navigator.language });
  renderSavedTemplates(); updateSelectionUI();
})();
