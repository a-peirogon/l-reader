use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchResult {
    pub id:       String,
    pub source:   String,
    pub title:    String,
    pub authors:  Vec<String>,
    pub year:     String,
    pub r#abstract: String,
    #[serde(rename = "pdfUrl")]
    pub pdf_url:  Option<String>,
    pub link:     String,
}

// ── arXiv ──────────────────────────────────────────────────────────────────────

fn strip_ns(tag: &str) -> &str {
    if let Some(pos) = tag.rfind(':') { &tag[pos + 1..] } else { tag }
}

fn parse_arxiv_xml(xml: &str) -> Vec<SearchResult> {
    use quick_xml::events::Event;
    use quick_xml::reader::Reader;

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut results = Vec::new();
    let mut current: Option<SearchResult> = None;
    let mut buf = Vec::new();
    let mut in_entry = false;
    let mut current_tag = String::new();
    let mut in_author = false;
    let mut author_buf = String::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                let tag = strip_ns(std::str::from_utf8(e.name().as_ref()).unwrap_or("")).to_owned();
                current_tag = tag.clone();
                match tag.as_str() {
                    "entry" => {
                        in_entry = true;
                        current = Some(SearchResult {
                            id: String::new(), source: "arxiv".into(),
                            title: String::new(), authors: Vec::new(),
                            year: String::new(), r#abstract: String::new(),
                            pdf_url: None, link: String::new(),
                        });
                    }
                    "author" if in_entry => { in_author = true; author_buf.clear(); }
                    _ => {}
                }
            }
            Ok(Event::End(e)) => {
                let tag = strip_ns(std::str::from_utf8(e.name().as_ref()).unwrap_or("")).to_owned();
                if tag == "author" && in_entry {
                    in_author = false;
                    let name = author_buf.trim().to_owned();
                    if !name.is_empty() {
                        if let Some(r) = current.as_mut() { r.authors.push(name); }
                    }
                }
                if tag == "entry" {
                    in_entry = false;
                    if let Some(mut r) = current.take() {
                        // Build PDF url from id
                        // id looks like http://arxiv.org/abs/XXXX.XXXXX
                        let arxiv_id = r.link.replace("http://arxiv.org/abs/", "")
                                              .replace("https://arxiv.org/abs/", "");
                        r.pdf_url = Some(format!("https://arxiv.org/pdf/{}", arxiv_id));
                        results.push(r);
                    }
                }
            }
            Ok(Event::Text(e)) => {
                let text = e.unescape().unwrap_or_default().trim().to_owned();
                if text.is_empty() { buf.clear(); continue; }
                if in_author && in_entry {
                    if current_tag == "name" { author_buf = text; }
                } else if let Some(r) = current.as_mut() {
                    match current_tag.as_str() {
                        "title"   => r.title    = text.replace('\n', " "),
                        "summary" => r.r#abstract = text.replace('\n', " "),
                        "published" => {
                            r.year = text.get(..4).unwrap_or("").to_owned();
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::Empty(e)) => {
                // <link> tags — find rel=alternate for abstract url
                let tag = strip_ns(std::str::from_utf8(e.name().as_ref()).unwrap_or("")).to_owned();
                if tag == "link" && in_entry {
                    let mut rel = String::new();
                    let mut href = String::new();
                    for attr in e.attributes().flatten() {
                        let k = std::str::from_utf8(attr.key.as_ref()).unwrap_or("").to_owned();
                        let v = attr.unescape_value().unwrap_or_default().into_owned();
                        match k.as_str() {
                            "rel"  => rel  = v,
                            "href" => href = v,
                            _ => {}
                        }
                    }
                    if rel == "alternate" {
                        if let Some(r) = current.as_mut() { r.link = href; }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    results
}

#[tauri::command]
pub async fn search_arxiv(q: String, limit: Option<u32>) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(12).min(50);
    let url = format!(
        "https://export.arxiv.org/api/query?search_query=all:{}&start=0&max_results={}",
        urlencoding::encode(&q),
        limit,
    );

    let client = Client::builder()
        .user_agent("Lectio/0.1")
        .build()
        .map_err(|e| e.to_string())?;

    let xml = client.get(&url)
        .send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;

    let mut results = parse_arxiv_xml(&xml);

    // Sort newest first, drop results without link
    results.retain(|r| !r.link.is_empty());
    results.sort_by(|a, b| b.year.cmp(&a.year));

    Ok(results)
}

// ── Scholar ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn search_scholar(q: String, limit: Option<u32>) -> Result<Vec<SearchResult>, String> {
    let limit = limit.unwrap_or(10).min(20) as usize;
    let url = format!(
        "https://scholar.google.com/scholar?q={}&hl=en&num={}",
        urlencoding::encode(&q),
        limit,
    );

    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client.get(&url)
        .send().await.map_err(|e| e.to_string())?
        .text().await.map_err(|e| e.to_string())?;

    let document = scraper::Html::parse_document(&html);
    let result_sel = scraper::Selector::parse(".gs_r.gs_or").unwrap();
    let title_sel  = scraper::Selector::parse("h3.gs_rt a, h3.gs_rt span").unwrap();
    let meta_sel   = scraper::Selector::parse(".gs_a").unwrap();
    let snippet_sel = scraper::Selector::parse(".gs_rs").unwrap();
    let pdf_sel    = scraper::Selector::parse(".gs_or_ggsm a").unwrap();

    let mut results = Vec::new();
    for el in document.select(&result_sel).take(limit) {
        // Title + link
        let title_el = el.select(&title_sel).next();
        let title = title_el.map(|e| e.text().collect::<String>()).unwrap_or_default();
        let link  = title_el
            .and_then(|e| e.value().attr("href"))
            .unwrap_or("").to_owned();

        if title.is_empty() { continue; }

        // Meta line: "Authors - Journal, Year - Publisher"
        let meta_text = el.select(&meta_sel).next()
            .map(|e| e.text().collect::<String>()).unwrap_or_default();

        let mut authors: Vec<String> = Vec::new();
        let mut year = String::new();

        if let Some(dash) = meta_text.find(" - ") {
            let author_part = &meta_text[..dash];
            authors = author_part.split(',')
                .map(|s| s.trim().to_owned())
                .filter(|s| !s.is_empty())
                .collect();

            // Find year: 4-digit number
            for part in meta_text[dash..].split([',', '-', '\u{00a0}']) {
                let t = part.trim();
                if t.len() == 4 && t.chars().all(|c| c.is_ascii_digit()) {
                    year = t.to_owned();
                    break;
                }
            }
        }

        let abstract_text = el.select(&snippet_sel).next()
            .map(|e| e.text().collect::<String>()).unwrap_or_default();

        let pdf_url = el.select(&pdf_sel).next()
            .and_then(|e| e.value().attr("href"))
            .map(|s| s.to_owned());

        results.push(SearchResult {
            id:       format!("scholar-{}", results.len()),
            source:   "scholar".into(),
            title:    title.trim().to_owned(),
            authors,
            year,
            r#abstract: abstract_text.trim().to_owned(),
            pdf_url,
            link,
        });
    }

    Ok(results)
}
