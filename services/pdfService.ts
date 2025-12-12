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
      
      // Title Box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin, height / 2 - 40, width - (margin * 2), 80, 5, 5, 'F');
      
      // Title Text
      doc.setTextColor(50, 50, 50);
      doc.setFont(activeFont, "normal"); 
      
      // Adjust size based on font (some are naturally smaller/larger)
      let titleSize = 32;
      if (activeFont === 'Bangers') titleSize = 38;
      if (activeFont === 'PatrickHand') titleSize = 36;

      doc.setFontSize(titleSize);
      doc.text(bookData.theme.toUpperCase(), width / 2, height / 2 - 10, { align: "center" });
      
      // "Coloring Book" subtitle
      doc.setFontSize(24);
      doc.text("Coloring Book", width / 2, height / 2 + 5, { align: "center" });

      doc.setFontSize(18);
      // Updated color to match new Primary (Indigo/Violet) approx #6366F1
      doc.setTextColor(99, 102, 241); 
      doc.text(`For ${bookData.childName}`, width / 2, height / 2 + 25, { align: "center" });
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
      
      // Footer
      doc.setFont(activeFont, "normal");
      doc.setFontSize(12);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${index + 1} - ${bookData.childName}'s ${bookData.theme} Adventure`, width / 2, height - 10, { align: "center" });
    });

    doc.save(`${bookData.childName}-${bookData.theme}-coloring-book.pdf`);
  } catch (renderError) {
    console.error("Error rendering PDF:", renderError);
    throw renderError;
  }
};