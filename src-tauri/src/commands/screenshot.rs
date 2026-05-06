//! Capture d’écran de la fenêtre principale (Windows — PrintWindow + PNG).

use tauri::Manager;

/// Ouvre une boîte « Enregistrer sous » et écrit une capture PNG de la fenêtre principale.
#[tauri::command]
pub fn screenshot_save_main_window(app: tauri::AppHandle) -> Result<Option<String>, String> {
  #[cfg(target_os = "windows")]
  {
    use image::codecs::png::{CompressionType, FilterType, PngEncoder};
    use image::{ExtendedColorType, ImageBuffer, ImageEncoder, RgbaImage};
    use windows::Win32::Graphics::Gdi::{
      BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetWindowDC, ReleaseDC,
      SelectObject, BI_RGB, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, HGDIOBJ, SRCCOPY,
    };
    use windows::Win32::Storage::Xps::{PrintWindow, PRINT_WINDOW_FLAGS};

    let win = app
      .get_webview_window("main")
      .ok_or_else(|| "Fenêtre principale introuvable.".to_string())?;
    let hwnd_tauri = win.hwnd().map_err(|e| e.to_string())?;
    // Tauri lie `windows` 0.61 ; notre dépendance directe est 0.58 — même layout (*mut c_void).
    let hwnd: windows::Win32::Foundation::HWND =
      unsafe { std::mem::transmute_copy(&hwnd_tauri) };

    // Pixels physiques tels que Tauri / WRY les exposent (HiDPI correct).
    let outer = win.outer_size().map_err(|e| e.to_string())?;
    let width = outer.width as i32;
    let height = outer.height as i32;
    if width <= 0 || height <= 0 {
      return Err("Taille de fenêtre invalide.".to_string());
    }

    let png = unsafe {
      // DC fenêtre complète (non-client + client) : mieux aligné avec PrintWindow que GetDC seul.
      let hdc_win = GetWindowDC(hwnd);
      if hdc_win.is_invalid() {
        return Err("Accès graphique impossible.".to_string());
      }

      let hdc_mem = CreateCompatibleDC(hdc_win);
      let hbmp = CreateCompatibleBitmap(hdc_win, width, height);
      let oldbmp: HGDIOBJ = SelectObject(hdc_mem, hbmp);

      // PW_RENDERFULLCONTENT : contenu complet (WebView / couches).
      let pw_ok = PrintWindow(hwnd, hdc_mem, PRINT_WINDOW_FLAGS(2));
      if !pw_ok.as_bool() {
        let _ = BitBlt(hdc_mem, 0, 0, width, height, hdc_win, 0, 0, SRCCOPY);
      }

      let mut bmi: BITMAPINFO = std::mem::zeroed();
      bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
      bmi.bmiHeader.biWidth = width;
      bmi.bmiHeader.biHeight = -height;
      bmi.bmiHeader.biPlanes = 1;
      bmi.bmiHeader.biBitCount = 32;
      bmi.bmiHeader.biCompression = BI_RGB.0;

      let n = (width * height * 4) as usize;
      let mut buf = vec![0u8; n];
      let lines = GetDIBits(
        hdc_mem,
        hbmp,
        0,
        height as u32,
        Some(buf.as_mut_ptr().cast()),
        &mut bmi,
        DIB_RGB_COLORS,
      );
      SelectObject(hdc_mem, oldbmp);
      let _ = DeleteObject(hbmp);
      let _ = DeleteDC(hdc_mem);
      let _ = ReleaseDC(hwnd, hdc_win);

      if lines == 0 {
        return Err("Lecture de l’image impossible.".to_string());
      }

      let mut rgba = Vec::with_capacity(n);
      for px in buf.chunks_exact(4) {
        rgba.push(px[2]);
        rgba.push(px[1]);
        rgba.push(px[0]);
        rgba.push(px[3]);
      }

      let img: RgbaImage =
        ImageBuffer::from_raw(width as u32, height as u32, rgba).ok_or_else(|| "Image invalide.".to_string())?;

      let mut png_bytes = Vec::new();
      PngEncoder::new_with_quality(&mut png_bytes, CompressionType::Best, FilterType::Adaptive)
        .write_image(img.as_raw(), img.width(), img.height(), ExtendedColorType::Rgba8)
        .map_err(|e| format!("Encodage PNG : {}", e))?;
      png_bytes
    };

    let default = format!(
      "YOBO_capture_{}.png",
      chrono::Local::now().format("%Y%m%d_%H%M%S")
    );
    let Some(path) = rfd::FileDialog::new()
      .set_title("Enregistrer la capture YOBO")
      .set_file_name(&default)
      .add_filter("Image PNG", &["png"])
      .save_file()
    else {
      return Ok(None);
    };
    std::fs::write(&path, &png).map_err(|e| format!("Écriture impossible : {}", e))?;
    return Ok(Some(path.to_string_lossy().into_owned()));
  }

  #[cfg(not(target_os = "windows"))]
  {
    Err("Capture d’écran disponible uniquement sous Windows.".to_string())
  }
}
