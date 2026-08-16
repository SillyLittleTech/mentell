fn main() {
  #[cfg(target_os = "macos")]
  {
    println!("cargo:rerun-if-changed=src/macos_notify.m");
    println!("cargo:rerun-if-changed=src/macos_notify.h");
    println!("cargo:rustc-link-lib=framework=UserNotifications");
    println!("cargo:rustc-link-lib=framework=Foundation");
    cc::Build::new()
      .file("src/macos_notify.m")
      .flag("-fobjc-arc")
      .compile("mentell_macos_notify");
  }
  tauri_build::build();
}
