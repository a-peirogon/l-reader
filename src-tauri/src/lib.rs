mod commands;

use commands::{ai, pdf, search};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            // Search
            search::search_arxiv,
            search::search_scholar,
            // PDF
            pdf::fetch_pdf,
            pdf::open_pdf_dialog,
            // AI
            ai::call_claude,
            ai::call_gemini,
            ai::build_doc_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error running Lectio");
}
