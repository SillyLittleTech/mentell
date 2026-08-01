use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};

const SUCCESS_HTML: &str = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Sign-in complete</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #505153; color: #f6f3ed; display: grid; place-items: center; min-height: 100vh; margin: 0; }
    main { text-align: center; max-width: 24rem; padding: 1.5rem; }
  </style>
</head>
<body>
  <main>
    <h1>Sign-in complete</h1>
    <p>You can close this browser tab and return to Mentell.</p>
  </main>
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      var hash = (location.hash || '').replace(/^#/, '');
      if (hash) {
        var hashParams = new URLSearchParams(hash);
        hashParams.forEach(function (value, key) { params.set(key, value); });
      }
      if (params.toString()) {
        fetch('/complete?' + params.toString(), { method: 'GET', mode: 'no-cors' }).catch(function () {});
      }
    })();
  </script>
</body>
</html>"#;

pub struct AuthCallbackState {
  stop: Arc<AtomicBool>,
  port: Mutex<Option<u16>>,
}

impl AuthCallbackState {
  pub fn new() -> Self {
    Self {
      stop: Arc::new(AtomicBool::new(true)),
      port: Mutex::new(None),
    }
  }
}

fn write_response(stream: &mut std::net::TcpStream, status: &str, body: &str) -> std::io::Result<()> {
  let response = format!(
    "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
    body.len()
  );
  stream.write_all(response.as_bytes())
}

fn handle_connection(
  mut stream: std::net::TcpStream,
  app: AppHandle,
  stop: Arc<AtomicBool>,
  port: u16,
) {
  let mut buffer = [0_u8; 8192];
  let read = match stream.read(&mut buffer) {
    Ok(0) | Err(_) => return,
    Ok(n) => n,
  };

  let request = String::from_utf8_lossy(&buffer[..read]);
  let request_line = request.lines().next().unwrap_or("");
  let mut parts = request_line.split_whitespace();
  let method = parts.next().unwrap_or("");
  let target = parts.next().unwrap_or("");

  if method != "GET" {
    let _ = write_response(&mut stream, "405 Method Not Allowed", "Method not allowed");
    return;
  }

  let path = target.split('?').next().unwrap_or("/");
  let query = target.split('?').nth(1).unwrap_or("");

  if path == "/" || path.is_empty() {
    if !query.is_empty() {
      let callback_url = format!("http://127.0.0.1:{port}/?{query}");
      let _ = app.emit("auth-callback", callback_url);
      stop.store(true, Ordering::SeqCst);
      let _ = write_response(
        &mut stream,
        "200 OK",
        "<!DOCTYPE html><html><body><p>Returning to Mentell…</p></body></html>",
      );
      return;
    }

    let _ = write_response(&mut stream, "200 OK", SUCCESS_HTML);
    return;
  }

  if path == "/complete" {
    if !query.is_empty() {
      let callback_url = format!("http://127.0.0.1:{port}/?{query}");
      let _ = app.emit("auth-callback", callback_url);
    }
    stop.store(true, Ordering::SeqCst);
    let _ = write_response(
      &mut stream,
      "200 OK",
      "<!DOCTYPE html><html><body><p>Returning to Mentell…</p></body></html>",
    );
    return;
  }

  let _ = write_response(&mut stream, "404 Not Found", "Not found");
}

fn run_server(app: AppHandle, stop: Arc<AtomicBool>, listener: TcpListener, port: u16) {
  listener.set_nonblocking(true).ok();

  while !stop.load(Ordering::SeqCst) {
    match listener.accept() {
      Ok((stream, _)) => {
        let app_clone = app.clone();
        let stop_clone = stop.clone();
        thread::spawn(move || handle_connection(stream, app_clone, stop_clone, port));
      }
      Err(err) if err.kind() == std::io::ErrorKind::WouldBlock => {
        thread::sleep(Duration::from_millis(25));
      }
      Err(_) => break,
    }
  }
}

#[tauri::command]
pub fn start_auth_callback(
  app: AppHandle,
  state: State<'_, AuthCallbackState>,
) -> Result<u16, String> {
  stop_auth_callback(state.clone())?;

  let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
    .map_err(|err| err.to_string())?;
  let port = listener.local_addr().map_err(|err| err.to_string())?.port();

  state.stop.store(false, Ordering::SeqCst);
  {
    let mut guard = state.port.lock().map_err(|_| "port lock poisoned".to_string())?;
    *guard = Some(port);
  }

  let stop_flag = state.stop.clone();
  thread::spawn(move || run_server(app, stop_flag, listener, port));

  Ok(port)
}

#[tauri::command]
pub fn stop_auth_callback(state: State<'_, AuthCallbackState>) -> Result<(), String> {
  state.stop.store(true, Ordering::SeqCst);
  let mut guard = state.port.lock().map_err(|_| "port lock poisoned".to_string())?;
  *guard = None;
  Ok(())
}
