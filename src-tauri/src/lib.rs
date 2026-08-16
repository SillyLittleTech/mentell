mod auth_callback;
mod local_notify;

use auth_callback::{start_auth_callback, stop_auth_callback, AuthCallbackState};
use local_notify::{
  cancel_weekly_notification, schedule_weekly_notification, show_native_notification,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_opener::init())
    .manage(AuthCallbackState::new())
    .invoke_handler(tauri::generate_handler![
      start_auth_callback,
      stop_auth_callback,
      show_native_notification,
      schedule_weekly_notification,
      cancel_weekly_notification,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
