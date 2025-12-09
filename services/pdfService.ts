import { jsPDF } from "jspdf";
import { BookData } from "../types";

export const generatePDF = (bookData: BookData) => {
  // A4 size: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const margin = 20;

  // 1. Cover Page
  const coverImage = bookData.images.find(img => img.type === 'cover');
  if (coverImage) {
    doc.addImage(coverImage.url, "PNG", 0, 0, width, height, undefined, "FAST");
    
    // Add a semi-transparent overlay for text readability if needed, or just a title box
    // Let's add a nice white box for the title
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, height / 2 - 40, width - (margin * 2), 80, 5, 5, 'F');
    
    // Dark grey for text
    doc.setTextColor(50, 50, 50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.text(bookData.theme.toUpperCase(), width / 2, height / 2 - 10, { align: "center" });
    
    doc.setFontSize(24);
    doc.setFont("helvetica", "normal");
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
    
    // Optional footer
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${index + 1} - ${bookData.childName}'s ${bookData.theme} Adventure`, width / 2, height - 10, { align: "center" });
  });

  doc.save(`${bookData.childName}-${bookData.theme}-coloring-book.pdf`);
};