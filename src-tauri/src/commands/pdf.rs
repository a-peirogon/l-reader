use base64::{Engine, engine::general_purpose::STANDARD};
use reqwest::Client;
use tauri_plugin_dialog::DialogExt;

/// Fetch a remote PDF and return it as base64.
/// Used by SearchPanel to import papers from arXiv.
#[tauri::command]
pub async fn fetch_pdf(url: String) -> Result<String, String> {
    let client = Client::builder()
        .user_agent("Lectio/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let bytes = client.get(&url)
        .send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;

    Ok(STANDARD.encode(&bytes))
}

/// Open a native file picker and return the selected PDF as base64 + filename.
#[tauri::command]
pub async fn open_pdf_dialog(
    app: tauri::AppHandle,
) -> Result<Option<(String, String)>, String> {
    use tauri_plugin_dialog::FilePath;

    let file = app
        .dialog()
        .file()
        .add_filter("PDF", &["pdf"])
        .blocking_pick_file();

    match file {
        Some(FilePath::Path(path)) => {
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("document.pdf")
                .to_owned();

            let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
            Ok(Some((STANDARD.encode(&bytes), name)))
        }
        _ => Ok(None),
    }
}
