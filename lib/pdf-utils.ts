'use client';

import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source - use CDN for reliability
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs`;
}

/**
 * Generate a thumbnail image from a PDF file
 * @param file The PDF file
 * @param maxWidth Maximum width of the thumbnail
 * @param maxHeight Maximum height of the thumbnail
 * @returns Promise resolving to a data URL of the thumbnail image
 */
export async function generatePdfThumbnail(
  file: File,
  maxWidth: number = 300,
  maxHeight: number = 400
): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Get the first page
    const page = await pdf.getPage(1);

    // Calculate scale to fit within max dimensions
    const viewport = page.getViewport({ scale: 1 });
    const scaleX = maxWidth / viewport.width;
    const scaleY = maxHeight / viewport.height;
    const scale = Math.min(scaleX, scaleY, 2); // Cap at 2x for quality

    const scaledViewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Render PDF page to canvas
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    // Convert to data URL (JPEG for smaller size)
    return canvas.toDataURL('image/jpeg', 0.8);
  } catch (error) {
    console.error('[PDF] Failed to generate thumbnail:', error);
    return null;
  }
}

/**
 * Extract text from a PDF file using pdfjs
 * @param file The PDF file
 * @returns Promise resolving to extracted text
 */
export async function extractPdfTextClient(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    // Extract text from all pages (up to first 10 for performance)
    const numPages = Math.min(pdf.numPages, 10);

    for (let i = 1; i <= numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      textParts.push(pageText);
    }

    return textParts.join('\n\n');
  } catch (error) {
    console.error('[PDF] Failed to extract text:', error);
    return '';
  }
}
