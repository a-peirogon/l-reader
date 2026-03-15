use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

fn client() -> Result<Client, String> {
    Client::builder()
        .user_agent("Lectio/0.1")
        .build()
        .map_err(|e| e.to_string())
}

// ── Shared types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiMessage {
    pub role:    String,
    pub content: Value,   // string or array of content parts
}

// ── Claude ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn call_claude(
    api_key: String,
    system:  String,
    messages: Vec<ApiMessage>,
    model:   Option<String>,
) -> Result<String, String> {
    let model = model.unwrap_or_else(|| "claude-sonnet-4-20250514".into());

    let body = json!({
        "model": model,
        "max_tokens": 1800,
        "system": system,
        "messages": messages,
    });

    let res = client()?
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send().await.map_err(|e| e.to_string())?;

    let data: Value = res.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = data.get("error") {
        return Err(err["message"].as_str().unwrap_or("Claude error").to_owned());
    }

    let text = data["content"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|b| b["text"].as_str())
        .collect::<Vec<_>>()
        .join("");

    Ok(text)
}

// ── Gemini ────────────────────────────────────────────────────────────────────

/// Convert Anthropic-style messages to Gemini contents format.
fn to_gemini_contents(messages: &[ApiMessage]) -> Vec<Value> {
    messages.iter().map(|m| {
        let role = if m.role == "assistant" { "model" } else { "user" };
        let parts: Vec<Value> = match &m.content {
            Value::String(s) => vec![json!({ "text": s })],
            Value::Array(parts) => parts.iter().map(|p| {
                if p["type"] == "text" {
                    json!({ "text": p["text"] })
                } else {
                    // inline image
                    json!({
                        "inlineData": {
                            "mimeType": p["source"]["media_type"],
                            "data": p["source"]["data"],
                        }
                    })
                }
            }).collect(),
            _ => vec![json!({ "text": "" })],
        };
        json!({ "role": role, "parts": parts })
    }).collect()
}

#[tauri::command]
pub async fn call_gemini(
    api_key: String,
    system:  String,
    messages: Vec<ApiMessage>,
    model:   Option<String>,
) -> Result<String, String> {
    let model = model.unwrap_or_else(|| "gemini-2.5-flash".into());
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, api_key,
    );

    let body = json!({
        "systemInstruction": { "parts": [{ "text": system }] },
        "contents": to_gemini_contents(&messages),
        "generationConfig": { "maxOutputTokens": 1800, "temperature": 0.7 },
    });

    let data: Value = client()?
        .post(&url)
        .json(&body)
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    if let Some(err) = data.get("error") {
        return Err(err["message"].as_str().unwrap_or("Gemini error").to_owned());
    }

    let text = data["candidates"][0]["content"]["parts"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|p| p["text"].as_str())
        .collect::<Vec<_>>()
        .join("");

    Ok(text)
}

// ── Doc summary (used on PDF import) ─────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct DocMeta {
    pub title:    String,
    pub r#type:   String,
    pub language: String,
    pub summary:  String,
    pub themes:   Vec<String>,
}

#[tauri::command]
pub async fn build_doc_summary(
    claude_key:  String,
    gemini_key:  String,
    gemini_model: String,
    sample_text: String,
) -> Result<Option<DocMeta>, String> {
    let system = "Eres un asistente experto en análisis de documentos académicos. \
        Respondes siempre en español. \
        Devuelves SOLO JSON válido, sin markdown, sin texto adicional.";

    let prompt = format!(
        "Analiza el siguiente documento completo y devuelve SOLO este JSON válido:\n\
        {{\n\
          \"title\": \"título exacto del documento\",\n\
          \"type\": \"paper | libro | informe | manual | otro\",\n\
          \"language\": \"idioma original del documento\",\n\
          \"summary\": \"resumen detallado EN ESPAÑOL de 5-7 oraciones: (1) qué problema aborda, \
            (2) qué propone, (3) metodología principal, (4) resultados clave, (5) conclusión o impacto\",\n\
          \"themes\": [\"tema1\", \"tema2\", \"tema3\", \"tema4\", \"tema5\"]\n\
        }}\n\n\
        DOCUMENTO:\n{}",
        sample_text
    );

    let raw = if !claude_key.is_empty() {
        let body = json!({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1200,
            "system": system,
            "messages": [{ "role": "user", "content": prompt }],
        });
        let data: Value = client()?
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &claude_key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send().await.map_err(|e| e.to_string())?
            .json().await.map_err(|e| e.to_string())?;

        if data.get("error").is_some() { return Ok(None); }
        data["content"].as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|b| b["text"].as_str())
            .collect::<Vec<_>>().join("")
    } else if !gemini_key.is_empty() {
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
            gemini_model, gemini_key,
        );
        let body = json!({
            "systemInstruction": { "parts": [{ "text": system }] },
            "contents": [{ "role": "user", "parts": [{ "text": prompt }] }],
            "generationConfig": {
                "maxOutputTokens": 1200,
                "temperature": 0.2,
                "responseMimeType": "application/json",
            },
        });
        let data: Value = client()?
            .post(&url)
            .json(&body)
            .send().await.map_err(|e| e.to_string())?
            .json().await.map_err(|e| e.to_string())?;

        if data.get("error").is_some() { return Ok(None); }
        data["candidates"][0]["content"]["parts"]
            .as_array().unwrap_or(&vec![])
            .iter()
            .filter_map(|p| p["text"].as_str())
            .collect::<Vec<_>>().join("")
    } else {
        return Ok(None);
    };

    if raw.is_empty() { return Ok(None); }

    // Strip possible markdown fences
    let clean = raw
        .trim_start_matches("```json").trim_start_matches("```")
        .trim_end_matches("```").trim();

    match serde_json::from_str::<DocMeta>(clean) {
        Ok(meta) => Ok(Some(meta)),
        Err(e) => {
            eprintln!("[build_doc_summary] parse error: {e} | raw: {}", &raw[..raw.len().min(300)]);
            Ok(None)
        }
    }
}
