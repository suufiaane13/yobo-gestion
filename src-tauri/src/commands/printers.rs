use serde::Deserialize;

#[cfg(windows)]
mod win {
  use windows::core::{PCWSTR, PWSTR};
  use windows::Win32::Foundation::{GetLastError, HANDLE};
  use windows::Win32::Graphics::Printing::{
    ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, OpenPrinterW, StartDocPrinterW,
    StartPagePrinter, WritePrinter, DOC_INFO_1W, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
    PRINTER_INFO_4W,
  };
  use std::ffi::c_void;

  fn to_wide_null(s: &str) -> Vec<u16> {
    let mut v: Vec<u16> = s.encode_utf16().collect();
    v.push(0);
    v
  }

  fn from_wide_ptr(p: *const u16) -> String {
    if p.is_null() {
      return String::new();
    }
    unsafe {
      let mut len = 0usize;
      while *p.add(len) != 0 {
        len += 1;
      }
      let slice = std::slice::from_raw_parts(p, len);
      String::from_utf16_lossy(slice)
    }
  }

  pub fn list_printers() -> Result<Vec<String>, String> {
    unsafe {
      let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
      let mut needed: u32 = 0;
      let mut returned: u32 = 0;

      // First call: get required buffer size (expected to fail, populates `needed`)
      let _ = EnumPrintersW(flags, PCWSTR::null(), 4, None, &mut needed, &mut returned);
      if needed == 0 {
        return Ok(vec![]);
      }

      let mut buf = vec![0u8; needed as usize];
      // Second call: fill buffer — windows 0.58 takes Option<&mut [u8]>
      EnumPrintersW(
        flags,
        PCWSTR::null(),
        4,
        Some(&mut buf),
        &mut needed,
        &mut returned,
      )
      .map_err(|e| format!("EnumPrintersW failed: {}", e))?;

      let base = buf.as_ptr() as *const PRINTER_INFO_4W;
      let mut out: Vec<String> = Vec::new();
      for i in 0..returned as usize {
        let pi = *base.add(i);
        let name = from_wide_ptr(pi.pPrinterName.0);
        let name = name.trim().to_string();
        if !name.is_empty() {
          out.push(name);
        }
      }
      out.sort();
      out.dedup();
      Ok(out)
    }
  }

  pub fn print_raw_text(printer_name: &str, job_name: &str, text: &str) -> Result<(), String> {
    unsafe {
      let mut h: HANDLE = HANDLE::default();
      let pn = to_wide_null(printer_name);

      // windows 0.58: OpenPrinterW returns Result<(), Error>
      OpenPrinterW(PCWSTR(pn.as_ptr()), &mut h, None)
        .map_err(|e| format!("OpenPrinter failed: {}", e))?;

      // RAII guard: close printer handle on drop
      struct Guard(HANDLE);
      impl Drop for Guard {
        fn drop(&mut self) {
          unsafe {
            let _ = ClosePrinter(self.0);
          }
        }
      }
      let _g = Guard(h);

      // windows 0.58: DOC_INFO_1W fields are PWSTR (mutable wide strings)
      let mut doc_name = to_wide_null(job_name);
      let mut dtype = to_wide_null("RAW");
      let mut output_file = to_wide_null("");

      let di = DOC_INFO_1W {
        pDocName: PWSTR(doc_name.as_mut_ptr()),
        pOutputFile: PWSTR(output_file.as_mut_ptr()),
        pDatatype: PWSTR(dtype.as_mut_ptr()),
      };

      // windows 0.58: StartDocPrinterW takes *const DOC_INFO_1W
      let job_id = StartDocPrinterW(h, 1, &di as *const DOC_INFO_1W);
      if job_id == 0 {
        return Err(format!("StartDocPrinter failed ({})", GetLastError().0));
      }

      // StartPagePrinter, WritePrinter, EndPagePrinter, EndDocPrinter retournent BOOL dans windows 0.58
      if !StartPagePrinter(h).as_bool() {
        let _ = EndDocPrinter(h);
        return Err(format!("StartPagePrinter failed ({})", GetLastError().0));
      }

      let bytes = text.as_bytes();
      let mut written: u32 = 0;
      if !WritePrinter(h, bytes.as_ptr() as *const c_void, bytes.len() as u32, &mut written).as_bool() {
        let _ = EndPagePrinter(h);
        let _ = EndDocPrinter(h);
        return Err(format!("WritePrinter failed ({})", GetLastError().0));
      }

      if written as usize != bytes.len() {
        let _ = EndPagePrinter(h);
        let _ = EndDocPrinter(h);
        return Err("WritePrinter: octets écrits incomplets.".to_string());
      }

      if !EndPagePrinter(h).as_bool() {
        return Err(format!("EndPagePrinter failed ({})", GetLastError().0));
      }
      if !EndDocPrinter(h).as_bool() {
        return Err(format!("EndDocPrinter failed ({})", GetLastError().0));
      }

      Ok(())
    }
  }

  pub fn print_raw_bytes(printer_name: &str, job_name: &str, bytes: &[u8]) -> Result<(), String> {
    unsafe {
      let mut h: HANDLE = HANDLE::default();
      let pn = to_wide_null(printer_name);

      OpenPrinterW(PCWSTR(pn.as_ptr()), &mut h, None)
        .map_err(|e| format!("OpenPrinter failed: {}", e))?;

      struct Guard(HANDLE);
      impl Drop for Guard {
        fn drop(&mut self) {
          unsafe {
            let _ = ClosePrinter(self.0);
          }
        }
      }
      let _g = Guard(h);

      let mut doc_name = to_wide_null(job_name);
      let mut dtype = to_wide_null("RAW");
      let mut output_file = to_wide_null("");

      let di = DOC_INFO_1W {
        pDocName: PWSTR(doc_name.as_mut_ptr()),
        pOutputFile: PWSTR(output_file.as_mut_ptr()),
        pDatatype: PWSTR(dtype.as_mut_ptr()),
      };

      let job_id = StartDocPrinterW(h, 1, &di as *const DOC_INFO_1W);
      if job_id == 0 {
        return Err(format!("StartDocPrinter failed ({})", GetLastError().0));
      }

      if !StartPagePrinter(h).as_bool() {
        let _ = EndDocPrinter(h);
        return Err(format!("StartPagePrinter failed ({})", GetLastError().0));
      }

      let mut written: u32 = 0;
      if !WritePrinter(h, bytes.as_ptr() as *const c_void, bytes.len() as u32, &mut written).as_bool() {
        let _ = EndPagePrinter(h);
        let _ = EndDocPrinter(h);
        return Err(format!("WritePrinter failed ({})", GetLastError().0));
      }

      if written as usize != bytes.len() {
        let _ = EndPagePrinter(h);
        let _ = EndDocPrinter(h);
        return Err("WritePrinter: octets écrits incomplets.".to_string());
      }

      if !EndPagePrinter(h).as_bool() {
        return Err(format!("EndPagePrinter failed ({})", GetLastError().0));
      }
      if !EndDocPrinter(h).as_bool() {
        return Err(format!("EndDocPrinter failed ({})", GetLastError().0));
      }

      Ok(())
    }
  }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterPrintRawTextInput {
  pub user_id: i64,
  pub printer_name: String,
  pub job_name: String,
  pub text: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrinterPrintRawBytesInput {
  pub user_id: i64,
  pub printer_name: String,
  pub job_name: String,
  pub bytes: Vec<u8>,
}

#[tauri::command]
pub fn printers_list() -> Result<Vec<String>, String> {
  #[cfg(windows)]
  {
    return win::list_printers();
  }
  #[cfg(not(windows))]
  {
    Ok(vec![])
  }
}

#[tauri::command]
pub fn printers_print_raw_text(input: PrinterPrintRawTextInput) -> Result<(), String> {
  // user_id présent pour audit futur ; impression locale.
  let _ = input.user_id;
  #[cfg(windows)]
  {
    let pn = input.printer_name.trim();
    if pn.is_empty() {
      return Err("Imprimante requise.".to_string());
    }
    let job = input.job_name.trim();
    let job = if job.is_empty() { "YOBO Ticket" } else { job };
    return win::print_raw_text(pn, job, &input.text);
  }
  #[cfg(not(windows))]
  {
    Err("Impression native non supportée sur cette plateforme.".to_string())
  }
}

#[tauri::command]
pub fn printers_print_raw_bytes(input: PrinterPrintRawBytesInput) -> Result<(), String> {
  let _ = input.user_id;
  #[cfg(windows)]
  {
    let pn = input.printer_name.trim();
    if pn.is_empty() {
      return Err("Imprimante requise.".to_string());
    }
    let job = input.job_name.trim();
    let job = if job.is_empty() { "YOBO Ticket" } else { job };
    return win::print_raw_bytes(pn, job, &input.bytes);
  }
  #[cfg(not(windows))]
  {
    Err("Impression native non supportée sur cette plateforme.".to_string())
  }
}
