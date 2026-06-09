// Prevents additional console window on Windows in release, do not remove!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Arc;
use std::sync::{OnceLock, Mutex};
use std::collections::HashSet;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
use tokio::sync::Semaphore;
use serde::{Serialize, Deserialize};
use tauri::{AppHandle, Emitter};

fn canceled_uploads() -> &'static Mutex<HashSet<String>> {
    static CANCELED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CANCELED.get_or_init(|| Mutex::new(HashSet::new()))
}

#[tauri::command]
fn cancel_upload(file_path: String) {
    println!("[Native Uploader] Registering cancel command for path: {}", file_path);
    if let Ok(mut canceled) = canceled_uploads().lock() {
        canceled.insert(file_path);
    }
}

// Structure representing an individual chunk's upload parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
struct UploadPart {
    #[serde(rename = "partNumber")]
    part_number: u32,
    url: String,
}

// Progress update payload emitted back to Next.js
#[derive(Clone, Serialize)]
struct UploadProgressPayload {
    #[serde(rename = "bytesSent")]
    bytes_sent: u64,
    #[serde(rename = "partNumber")]
    part_number: u32,
}

// Complete result of a single part upload, containing ETag
#[derive(Serialize, Deserialize, Clone)]
struct UploadPartResponse {
    #[serde(rename = "PartNumber")]
    part_number: u32,
    #[serde(rename = "ETag")]
    etag: String,
}

// Structure for file size and name metadata
#[derive(Serialize)]
struct FileMetadata {
    name: String,
    size: u64,
}

/// Retrieve absolute file path size and file name natively
#[tauri::command]
async fn get_file_metadata(file_path: String) -> Result<FileMetadata, String> {
    let metadata = std::fs::metadata(&file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    
    let name = std::path::Path::new(&file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_string();

    Ok(FileMetadata {
        name,
        size: metadata.len(),
    })
}

/// A highly-optimized, multi-threaded, parallel chunk uploader.
/// Bypasses browser JS thread bottlenecks and socket pooling constraints.
#[tauri::command]
async fn upload_file_native(
    app: AppHandle,
    file_path: String,
    parts: Vec<UploadPart>,
    chunk_size: u64,
) -> Result<Vec<UploadPartResponse>, String> {
    println!("[Native Uploader] Initiating upload for: {}", file_path);

    // Reset any previous cancellation status for this file to allow clean re-upload
    if let Ok(mut canceled) = canceled_uploads().lock() {
        canceled.remove(&file_path);
    }

    // Initialize high-performance HTTP client with optimized pool and keepalive
    let client = reqwest::Client::builder()
        .tcp_keepalive(std::time::Duration::from_secs(60))
        .pool_max_idle_per_host(24) // Raised to support higher concurrency without socket close/re-open overhead
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let client = Arc::new(client);
    let file_path = Arc::new(file_path);
    let parts_results = Arc::new(tokio::sync::Mutex::new(Vec::new()));

    // Limit concurrency to match the browser's high-performance parallel upload capability (optimal = 12 concurrent workers)
    let concurrency_limit = 12;
    let semaphore = Arc::new(Semaphore::new(concurrency_limit));
    let mut tasks = Vec::new();

    for part in parts {
        let client = Arc::clone(&client);
        let file_path = Arc::clone(&file_path);
        let semaphore = Arc::clone(&semaphore);
        let parts_results = Arc::clone(&parts_results);
        let app = app.clone();

        // Spawn a green thread for each part upload
        let task = tokio::spawn(async move {
            // Check cancellation before acquiring permit
            if canceled_uploads().lock().map(|c| c.contains(&*file_path)).unwrap_or(false) {
                return Err("Upload canceled by user".to_string());
            }

            // Acquire concurrency permit
            let _permit = semaphore.acquire().await.unwrap();

            // Check cancellation after acquiring permit
            if canceled_uploads().lock().map(|c| c.contains(&*file_path)).unwrap_or(false) {
                return Err("Upload canceled by user".to_string());
            }

            // Calculate precise slice size for this chunk
            let file_size = std::fs::metadata(&*file_path)
                .map_err(|e| format!("Failed to read file size: {}", e))?
                .len();
            let start_offset = (part.part_number - 1) as u64 * chunk_size;
            let bytes_to_read = std::cmp::min(chunk_size, file_size.saturating_sub(start_offset));

            if bytes_to_read == 0 {
                return Err(format!("Zero bytes calculated for part {}", part.part_number));
            }

            // Open file and seek to starting position of this chunk
            let mut file = File::open(&*file_path)
                .await
                .map_err(|e| format!("Failed to open file: {}", e))?;

            file.seek(SeekFrom::Start(start_offset))
                .await
                .map_err(|e| format!("Failed to seek file: {}", e))?;

            // Read the exact slice size to ensure robust S3 standards compliance
            let mut buffer = vec![0u8; bytes_to_read as usize];
            file.read_exact(&mut buffer)
                .await
                .map_err(|e| format!("Failed to read file slice: {}", e))?;

            let bytes_read = buffer.len();

            // Check cancellation right before HTTP request
            if canceled_uploads().lock().map(|c| c.contains(&*file_path)).unwrap_or(false) {
                return Err("Upload canceled by user".to_string());
            }

            println!(
                "[Native Uploader] Starting upload for Part {}, Size: {} bytes",
                part.part_number, bytes_read
            );

            // Execute raw PUT to S3 / Cloudflare R2 presigned URL
            let response = client
                .put(&part.url)
                .body(buffer)
                .header("Content-Type", "application/octet-stream")
                .send()
                .await
                .map_err(|e| format!("Network error on Part {}: {}", part.part_number, e))?;

            if !response.status().is_success() {
                let status = response.status();
                let status_err = response.text().await.unwrap_or_default();
                return Err(format!(
                    "R2/B2 Server rejected Part {} with status {}: {}",
                    part.part_number,
                    status,
                    status_err
                ));
            }

            // Get ETag from response header (S3 standards require ETag to verify upload completeness)
            let etag = response
                .headers()
                .get("ETag")
                .and_then(|h| h.to_str().ok())
                .map(|s| s.replace('"', "")) // Clean up quotes
                .ok_or_else(|| format!("No ETag header found for Part {}", part.part_number))?;

            println!(
                "[Native Uploader] Part {} completed. ETag: {}",
                part.part_number, etag
            );

            // Emit progress event back to the webview UI
            let _ = app.emit(
                "upload-progress",
                UploadProgressPayload {
                    bytes_sent: bytes_read as u64,
                    part_number: part.part_number,
                },
            );

            // Store result
            parts_results.lock().await.push(UploadPartResponse {
                part_number: part.part_number,
                etag,
            });

            Ok(())
        });

        tasks.push(task);
    }

    // Await all tasks to finish
    for task in tasks {
        task.await
            .map_err(|e| format!("Thread panic: {}", e))??;
    }

    // Sort parts sequentially (required by S3 CompleteMultipartUpload)
    let mut final_parts = parts_results.lock().await.clone();
    final_parts.sort_by_key(|p| p.part_number);

    println!("[Native Uploader] All chunks uploaded successfully!");
    Ok(final_parts)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![upload_file_native, get_file_metadata, cancel_upload])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
