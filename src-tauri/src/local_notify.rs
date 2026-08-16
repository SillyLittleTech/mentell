use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

#[cfg(target_os = "macos")]
use std::ffi::CString;
#[cfg(target_os = "macos")]
use std::os::raw::c_char;

#[cfg(target_os = "macos")]
extern "C" {
  fn mentell_schedule_weekly(
    weekday: i32,
    hour: i32,
    minute: i32,
    title: *const c_char,
    body: *const c_char,
  );
  fn mentell_cancel_weekly();
}

/// Immediate OS banner while the desktop app is running (`notify-rust` / Notification Center).
#[tauri::command]
pub fn show_native_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
  app
    .notification()
    .builder()
    .title(title)
    .body(body)
    .show()
    .map_err(|e| e.to_string())
}

/// Repeating weekly local notification (macOS UserNotifications). Survives app quit.
/// `weekday` is 0 = Sunday … 6 = Saturday (same as the web settings).
#[tauri::command]
pub fn schedule_weekly_notification(
  weekday: i32,
  hour: i32,
  minute: i32,
  title: String,
  body: String,
) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    let wd = weekday.clamp(0, 6) + 1; // NSCalendar: 1 = Sunday
    let title_c = CString::new(title).map_err(|_| "title contained NUL")?;
    let body_c = CString::new(body).map_err(|_| "body contained NUL")?;
    unsafe {
      mentell_schedule_weekly(wd, hour.clamp(0, 23), minute.clamp(0, 59), title_c.as_ptr(), body_c.as_ptr());
    }
    Ok(())
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = (weekday, hour, minute, title, body);
    Ok(())
  }
}

#[tauri::command]
pub fn cancel_weekly_notification() -> Result<(), String> {
  #[cfg(target_os = "macos")]
  unsafe {
    mentell_cancel_weekly();
  }
  Ok(())
}
