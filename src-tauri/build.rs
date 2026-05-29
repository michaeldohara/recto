fn main() {
    // Capture git short SHA at build time so the UI can show which
    // exact commit is running (helpful when verifying dev builds).
    // Falls back to "unknown" if git isn't on PATH or this isn't a
    // git checkout.
    let sha = std::process::Command::new("git")
        .args(["rev-parse", "--short=8", "HEAD"])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok().map(|s| s.trim().to_string())
            } else {
                None
            }
        })
        .unwrap_or_else(|| "unknown".to_string());
    println!("cargo:rustc-env=RECTO_GIT_SHA={sha}");

    // Re-run if the working commit changes (so SHA stays fresh in
    // incremental builds without forcing a clean compile).
    println!("cargo:rerun-if-changed=../.git/HEAD");
    println!("cargo:rerun-if-changed=../.git/refs/heads");

    tauri_build::build()
}
