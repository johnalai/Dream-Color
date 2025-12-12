import { GoogleGenAI, Type } from "@google/genai";
import { Scene, GeneratedImage, ColoringMode } from "../types";

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getAgeContext = (ageGroup: string) => {
  switch (ageGroup) {
    case '1-3':
      return "For toddlers (1-3 years old). Descriptions must be extremely simple, focusing on single large objects (e.g., 'A big happy dinosaur'). No background details. Focus on basic shapes.";
    case '3-5':
      return "For preschoolers (3-5 years old). Descriptions should be simple and cute with clear actions. Minimal background details.";
    case '5-8':
      return "For school-age kids (5-8 years old). Descriptions can have moderate detail, interactions between characters, and some background elements.";
    case '9+':
      return "For older kids (9+ years old). Descriptions can be detailed, complex, and involve intricate scenes or patterns.";
    default:
      return "For children.";
  }
};

/**
 * Programmatically generates a handwriting worksheet using HTML5 Canvas.
 * This ensures perfect text accuracy compared to AI image generation.
 */
const generateTracePage = (description: string, fontId: string): string => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("Canvas not supported");

  // A4-ish ratio high res (approx 150 DPI)
  const width = 1240; 
  const height = 1754; 
  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Parse letters from description
  // Format from generateScenes: "Handwriting practice for letters: A, B, C"
  const lettersPart = description.split(": ")[1] || "";
  const letters = lettersPart.split(",").map(s => s.trim()).filter(l => l.length === 1);

  // Layout Constants
  const marginX = 100;
  let currentY = 150;
  
  // Font Mapping for Header
  const fontMap: Record<string, string> = {
    'helvetica': 'Nunito, sans-serif',
    'chewy': 'Chewy, cursive',
    'bangers': 'Bangers, cursive',
    'patrick': '"Patrick Hand", cursive'
  };
  const headerFontFamily = fontMap[fontId] || 'Nunito, sans-serif';

  // Header
  ctx.font = `600 50px ${headerFontFamily}`;
  ctx.fillStyle = "#1F2937"; // Dark gray
  ctx.fillText("Name: __________________________", marginX, currentY);
  currentY += 120; // Space after header

  // Dynamic sizing based on content
  // We have restricted space. If many letters, shrink slightly.
  // Standard: ~4-5 letters per page.
  const availableHeight = height - currentY - 100; // Bottom padding
  const rowsNeeded = letters.length * 2; // 2 rows per letter
  // Calculate max row height that fits
  const maxRowHeight = Math.floor(availableHeight / rowsNeeded);
  const rowHeight = Math.min(220, Math.max(120, maxRowHeight)); // Clamp between 120 and 220
  
  // Font size relative to row height
  const fontSize = Math.floor(rowHeight * 0.6); 
  const font = `${fontSize}px Nunito, sans-serif`;

  const guideWidth = width - (marginX * 2);

  const drawGuides = (y: number) => {
     // Guide lines relative to baseline 'y'
     const baseline = y;
     const midline = y - (fontSize * 0.55); // Optically center roughly
     const topline = y - (fontSize * 1.05);

     ctx.lineWidth = 2;
     
     // Top Line (Solid Gray)
     ctx.beginPath();
     ctx.moveTo(marginX, topline);
     ctx.lineTo(width - marginX, topline);
     ctx.strokeStyle = "#9CA3AF"; 
     ctx.setLineDash([]);
     ctx.stroke();

     // Middle Line (Dashed Blue-ish)
     ctx.beginPath();
     ctx.moveTo(marginX, midline);
     ctx.lineTo(width - marginX, midline);
     ctx.strokeStyle = "#60A5FA"; // Blue-400
     ctx.setLineDash([15, 15]);
     ctx.stroke();

     // Bottom Line (Solid Black)
     ctx.beginPath();
     ctx.moveTo(marginX, baseline);
     ctx.lineTo(width - marginX, baseline);
     ctx.strokeStyle = "#000000";
     ctx.setLineDash([]);
     ctx.stroke();
  };

  letters.forEach(letter => {
     const pair = `${letter}${letter.toLowerCase()}`; // "Aa"
     const pairWithSpace = `${pair}    `; // Add spacing for repetition
     
     // --- ROW 1: REPEATED PATTERN ---
     let row1BaseY = currentY + (rowHeight * 0.75);
     drawGuides(row1BaseY);

     ctx.font = font;
     ctx.fillStyle = "#D1D5DB"; // Light Gray for tracing
     
     let textX = marginX + 20; // Slight indent
     // Fill the line
     while (textX + ctx.measureText(pair).width < width - marginX) {
        ctx.fillText(pair, textX, row1BaseY - (fontSize * 0.05)); // Small visual tweak for baseline
        textX += ctx.measureText(pairWithSpace).width;
     }
     
     currentY += rowHeight;

     // --- ROW 2: SINGLE + SPACE ---
     let row2BaseY = currentY + (rowHeight * 0.75);
     drawGuides(row2BaseY);

     ctx.fillStyle = "#D1D5DB"; 
     ctx.fillText(pair, marginX + 20, row2BaseY - (fontSize * 0.05));
     
     currentY += rowHeight;
  });

  return canvas.toDataURL("image/png");
};

export const generateScenes = async (
  theme: string, 
  pageCount: number, 
  ageGroup: string,
  mode: ColoringMode = 'standard'
): Promise<Scene[]> => {
  
  // SPECIAL HANDLING FOR TRACE MODE
  // We don't want random scenes; we want A-Z split across the pages.
  if (mode === 'trace') {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    const scenes: Scene[] = [];
    
    // Calculate letters per page
    const totalLetters = 26;
    const lettersPerPage = Math.ceil(totalLetters / pageCount);
    
    for (let i = 0; i < pageCount; i++) {
      const startIdx = i * lettersPerPage;
      // If we've run out of letters, stop generating pages (or just loop/fill)
      if (startIdx >= totalLetters) break;

      const endIdx = Math.min(startIdx + lettersPerPage, totalLetters);
      const pageLetters = alphabet.slice(startIdx, endIdx);
      
      scenes.push({
        id: `scene-${i}`,
        description: `Handwriting practice for letters: ${pageLetters.join(', ')}`,
      });
    }
    return scenes;
  }

  // STANDARD GENERATION FOR OTHER MODES
  const ageContext = getAgeContext(ageGroup);
  
  const prompt = `Generate ${pageCount} distinct, fun, and creative scene descriptions for a children's coloring book based on the theme: "${theme}". 
  ${ageContext}
  The descriptions should be visual, simple enough for a coloring page, and engaging.
  Return ONLY a JSON array of strings.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No text returned from Gemini");

    const parsed = JSON.parse(text) as { description: string }[];
    
    // Ensure we respect the requested count
    const limitedParsed = parsed.slice(0, pageCount);

    return limitedParsed.map((item, index) => ({
      id: `scene-${index}`,
      description: item.description,
    }));
  } catch (error) {
    console.error("Error generating scenes:", error);
    throw new Error("Failed to plan the coloring book. Please try again.");
  }
};

export const generateImage = async (
  description: string, 
  type: 'cover' | 'page',
  ageGroup: string = '3-5',
  mode: ColoringMode = 'standard',
  fontId: string = 'helvetica'
): Promise<string> => {
  
  // INTERCEPT: If mode is trace and it's a page, use programmatic generation
  if (mode === 'trace' && type === 'page') {
    // We wrap this in a promise to match the async signature, 
    // though canvas generation is synchronous.
    return Promise.resolve(generateTracePage(description, fontId));
  }

  const model = "gemini-2.5-flash-image"; 
  let prompt = "";
  
  if (type === 'cover') {
    prompt = `A vibrant, colorful, cheerful children's book cover illustration. 
    Subject: ${description}. 
    Target Audience: Kids aged ${ageGroup}.
    Style: Cute cartoon style, high quality, bright colors, inviting. 
    Do not include text.`;
  } else {
    // Tailor coloring page style to age
    let styleInstruction = "";
    switch (ageGroup) {
      case '1-3':
        styleInstruction = "Very thick extra-bold lines. Extremely simple shapes. No background details. Large subject centered on page. Easy to color for toddlers.";
        break;
      case '3-5':
        styleInstruction = "Thick bold lines. Simple cute characters. Minimal background. Clear distinct shapes. Easy to color.";
        break;
      case '5-8':
        styleInstruction = "Standard coloring book line weight. Moderate detail. Fun scenes with some background elements. Clean lines.";
        break;
      case '9+':
        styleInstruction = "Finer lines. Detailed and intricate patterns (like a mandala or detailed scene). complex background. Engaging for older kids.";
        break;
      default:
        styleInstruction = "Thick distinct black lines, pure white background.";
    }

    if (mode === 'number') {
      prompt = `A black and white "color by number" coloring page for children aged ${ageGroup}.
      Subject: ${description}.
      Style: ${styleInstruction}
      IMPORTANT: The image must be segmented into distinct regions. Inside each region, place a small number (e.g. 1, 2, 3, 4, 5). 
      Include a simple Legend/Key at the bottom of the page (e.g. 1=Red, 2=Blue).
      Pure white background. Black line art. No shading, no grayscale, no filled colors.`;
    } else if (mode === 'letter') {
      prompt = `A black and white "color by letter" coloring page for children aged ${ageGroup}.
      Subject: ${description}.
      Style: ${styleInstruction}
      IMPORTANT: The image must be segmented into distinct regions. Inside each region, place a capital letter (e.g. A, B, C, D). 
      Include a simple Legend/Key at the bottom of the page (e.g. A=Yellow, B=Green).
      Pure white background. Black line art. No shading, no grayscale, no filled colors.`;
    } else {
      prompt = `A black and white coloring book page for children aged ${ageGroup}. 
      Subject: ${description}. 
      Style: ${styleInstruction}
      Pure white background. No shading, no grayscale, no gradients, no colors. 
      Vector art style, high contrast.`;
    }
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "3:4" 
        }
      }
    });

    let base64Data = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        base64Data = part.inlineData.data;
        break;
      }
    }

    if (!base64Data) throw new Error("No image data returned");

    const mimeType = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType || "image/png";

    return `data:${mimeType};base64,${base64Data}`;

  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image.");
  }
};