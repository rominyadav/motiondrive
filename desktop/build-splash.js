const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const templatePath = path.join(__dirname, 'dist/index.html.template');
const outputPath = path.join(__dirname, 'dist/index.html');

console.log('[Build Splash] Running splash screen compiler...');

// 1. Read and parse .env file
let appUrl = 'https://drive.motionsewa.com'; // Absolute safety fallback

if (fs.existsSync(envPath)) {
  console.log('[Build Splash] Found root .env file at:', envPath);
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  // Parse lines to find NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL
  const lines = envContent.split('\n');
  let extractedUrl = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    
    const [key, ...valueParts] = trimmed.split('=');
    const val = valueParts.join('=').trim().replace(/['"]/g, ''); // Remove single or double quotes
    
    if (key.trim() === 'NEXT_PUBLIC_APP_URL') {
      extractedUrl = val;
      break; // Highest priority
    } else if (key.trim() === 'BETTER_AUTH_URL' && !extractedUrl) {
      extractedUrl = val;
    }
  }
  
  if (extractedUrl) {
    appUrl = extractedUrl;
    console.log('[Build Splash] Extracted domain from .env:', appUrl);
  } else {
    console.warn('[Build Splash] Warning: NEXT_PUBLIC_APP_URL or BETTER_AUTH_URL not found in .env. Using fallback:', appUrl);
  }
} else {
  console.warn('[Build Splash] Warning: .env file not found at', envPath, '. Using fallback:', appUrl);
}

// 2. Read template and substitute placeholder
if (!fs.existsSync(templatePath)) {
  console.error('[Build Splash] Error: Template file missing at', templatePath);
  process.exit(1);
}

const templateContent = fs.readFileSync(templatePath, 'utf8');
const finalContent = templateContent.replace('__APP_URL__', appUrl);

// 3. Write output
fs.writeFileSync(outputPath, finalContent, 'utf8');
console.log('[Build Splash] Successfully compiled and wrote splash loader to:', outputPath);
process.exit(0);
