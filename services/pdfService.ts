import { jsPDF } from "jspdf";
import { BookData } from "../types";

// Using raw.githubusercontent.com for stable direct file access with CORS support
const FONT_URLS: Record<string, string> = {
  'chewy': 'https://raw.githubusercontent.com/google/fonts/main/ofl/chewy/Chewy-Regular.ttf',
  'patrick': 'https://raw.githubusercontent.com/google/fonts/main/ofl/patrickhand/PatrickHand-Regular.ttf',
  'bangers': 'https://raw.githubusercontent.com/google/fonts/main/ofl/bangers/Bangers-Regular.ttf'
};

const FONT_NAMES: Record<string, string> = {
  'chewy': 'Chewy',
  'patrick': 'PatrickHand',
  'bangers': 'Bangers'
};

// Helper to fetch font and convert to base64 using FileReader
const fetchFont = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch font: ${response.statusText}`);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // remove data:application/octet-stream;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    // Re-throw to be handled by the caller
    throw error;
  }
};

export const generatePDF = async (bookData: BookData) => {
  // A4 size: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // Load custom font if selected and valid
  let activeFont = "helvetica";
  const fontId = bookData.fontId;

  if (fontId && FONT_URLS[fontId]) {
    try {
      const fontBase64 = await fetchFont(FONT_URLS[fontId]);
      const fontName = FONT_NAMES[fontId];
      
      doc.addFileToVFS(`${fontName}.ttf`, fontBase64);
      doc.addFont(`${fontName}.ttf`, fontName, "normal");
      
      // Verify font works by setting it. 
      doc.setFont(fontName, "normal");
      activeFont = fontName;
    } catch (e) {
      console.warn("Failed to load custom font (likely network restriction), falling back to Helvetica.", e);
      // Fallback
      activeFont = "helvetica";
      doc.setFont("helvetica", "normal");
    }
  } else {
    doc.setFont("helvetica", "normal");
  }

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 20;

  try {
    // 1. Cover Page
    const coverImage = bookData.images.find(img => img.type === 'cover');
    if (coverImage) {
      doc.addImage(coverImage.url, "PNG", 0, 0, width, height, undefined, "FAST");
      
      // -- Cover Layout Logic --
      const boxHeight = 90; 
      // Position at bottom with some padding
      const boxY = height - boxHeight - 10;
      const boxWidth = width - (margin * 2);
      const centerX = width / 2;
      const maxTextWidth = boxWidth - 20; // Internal padding
      
      doc.setFont(activeFont, "normal"); 
      
      const titleText = bookData.theme.toUpperCase();
      const subtitleText = "COLORING BOOK";
      const artistText = `Created for ${bookData.childName}`;

      // 1. Calculate Title Size
      // Start larger for fun fonts
      let titleFontSize = 36;
      if (activeFont === 'Bangers') titleFontSize = 42;
      if (activeFont === 'PatrickHand') titleFontSize = 40;
      if (activeFont === 'Chewy') titleFontSize = 40;

      doc.setFontSize(titleFontSize);
      // Shrink to fit
      while (doc.getTextWidth(titleText) > maxTextWidth && titleFontSize > 12) {
        titleFontSize -= 1;
        doc.setFontSize(titleFontSize);
      }

      // 2. Calculate Subtitle Size
      let subtitleFontSize = 24;
      doc.setFontSize(subtitleFontSize);
      while (doc.getTextWidth(subtitleText) > maxTextWidth && subtitleFontSize > 10) {
        subtitleFontSize -= 1;
        doc.setFontSize(subtitleFontSize);
      }

      // 3. Calculate Artist Size (Child Name)
      // Base size
      let artistFontSize = 20;
      doc.setFontSize(artistFontSize);
      while (doc.getTextWidth(artistText) > maxTextWidth && artistFontSize > 10) {
        artistFontSize -= 1;
        doc.setFontSize(artistFontSize);
      }

      // -- Vertical Positioning --
      // Approx height conversion (1pt ~ 0.35mm)
      const ptToMm = 0.3528;
      // Spacing between lines
      const spacingSmall = 6;
      const spacingLarge = 12;

      const titleH = titleFontSize * ptToMm;
      const subtitleH = subtitleFontSize * ptToMm;
      const artistH = artistFontSize * ptToMm;

      const totalBlockHeight = titleH + spacingSmall + subtitleH + spacingLarge + artistH;

      // Start Y (top of the text block relative to box)
      const blockStartY = boxY + (boxHeight - totalBlockHeight) / 2;

      // Draw Title
      let currentY = blockStartY + titleH;
      
      // To simulate stroke/shadow for readability without white box
      const drawTextWithOutline = (text: string, x: number, y: number, size: number, color: [number, number, number]) => {
         doc.setFontSize(size);
         
         // Simulated outline (draw text slightly offset in white)
         doc.setTextColor(255, 255, 255);
         const offset = 0.5;
         doc.text(text, x - offset, y - offset, { align: "center" });
         doc.text(text, x + offset, y - offset, { align: "center" });
         doc.text(text, x - offset, y + offset, { align: "center" });
         doc.text(text, x + offset, y + offset, { align: "center" });
         
         // Main text
         doc.setTextColor(color[0], color[1], color[2]);
         doc.text(text, x, y, { align: "center" });
      };

      drawTextWithOutline(titleText, centerX, currentY, titleFontSize, [50, 50, 50]);
      
      // Draw Subtitle
      currentY += spacingSmall + subtitleH;
      drawTextWithOutline(subtitleText, centerX, currentY, subtitleFontSize, [236, 72, 153]);

      // Draw Artist
      currentY += spacingLarge + artistH;
      drawTextWithOutline(artistText, centerX, currentY, artistFontSize, [99, 102, 241]);
    }

    // 2. Coloring Pages
    const pages = bookData.images.filter(img => img.type === 'page');
    
    pages.forEach((page, index) => {
      doc.addPage();
      
      // Add the image centered
      // Ensure 3:4 aspect ratio fits within A4 margins
      const imgWidth = width - (margin * 2);
      const imgHeight = (imgWidth * 4) / 3;
      
      // Check if it fits vertically
      let finalW = imgWidth;
      let finalH = imgHeight;
      
      if (finalH > height - (margin * 2)) {
        finalH = height - (margin * 2);
        finalW = (finalH * 3) / 4;
      }

      const x = (width - finalW) / 2;
      const y = (height - finalH) / 2;

      doc.addImage(page.url, "PNG", x, y, finalW, finalH, undefined, "FAST");
      
      // Footer - Page Number at Bottom Right
      doc.setFont(activeFont, "normal");
      doc.setFontSize(12);
      doc.setTextColor(150, 150, 150);
      // Aligned right, using margin for spacing
      doc.text(`${index + 1}`, width - margin, height - 10, { align: "right" });
    });

    doc.save(`${bookData.childName}-${bookData.theme}-coloring-book.pdf`);
  } catch (renderError) {
    console.error("Error rendering PDF:", renderError);
    throw renderError;
  }
};