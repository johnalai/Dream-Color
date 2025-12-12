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
 * Uses a masking technique to create single thick dashed lines.
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

  // 1. Draw Background (White)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Parse letters
  const lettersPart = description.split(": ")[1] || "";
  const letters = lettersPart.split(",").map(s => s.trim()).filter(l => l.length === 1);

  // Layout Constants
  const marginX = 100;
  let currentY = 150;
  
  // Font Mapping
  const fontMap: Record<string, string> = {
    'helvetica': 'Nunito, sans-serif',
    'chewy': 'Chewy, cursive',
    'bangers': 'Bangers, cursive',
    'patrick': '"Patrick Hand", cursive'
  };
  const headerFontFamily = fontMap[fontId] || 'Nunito, sans-serif';

  // Draw Header directly on background
  ctx.font = `600 50px ${headerFontFamily}`;
  ctx.fillStyle = "#1F2937";
  ctx.fillText("Name: __________________________", marginX, currentY);
  currentY += 120;

  // Dynamic sizing
  const availableHeight = height - currentY - 100;
  const rowsNeeded = letters.length * 2;
  const maxRowHeight = Math.floor(availableHeight / rowsNeeded);
  const rowHeight = Math.min(220, Math.max(120, maxRowHeight)); 
  const fontSize = Math.floor(rowHeight * 0.65); 
  const font = `700 ${fontSize}px Nunito, sans-serif`; // Bold for "Thick" lines

  // 2. Draw Guides directly on background
  const drawGuides = (y: number) => {
     const baseline = y;
     const midline = y - (fontSize * 0.55); 
     const topline = y - (fontSize * 1.05);

     ctx.lineWidth = 2;
     ctx.beginPath();
     ctx.moveTo(marginX, topline);
     ctx.lineTo(width - marginX, topline);
     ctx.strokeStyle = "#9CA3AF"; 
     ctx.setLineDash([]);
     ctx.stroke();

     ctx.beginPath();
     ctx.moveTo(marginX, midline);
     ctx.lineTo(width - marginX, midline);
     ctx.strokeStyle = "#60A5FA"; // Blue-400
     ctx.setLineDash([15, 15]);
     ctx.stroke();

     ctx.beginPath();
     ctx.moveTo(marginX, baseline);
     ctx.lineTo(width - marginX, baseline);
     ctx.strokeStyle = "#000000";
     ctx.setLineDash([]);
     ctx.stroke();
  };

  // 3. Create a separate canvas for the Text so we can mask it safely
  const textCanvas = document.createElement('canvas');
  textCanvas.width = width;
  textCanvas.height = height;
  const tCtx = textCanvas.getContext('2d');
  if (!tCtx) return canvas.toDataURL();

  tCtx.font = font;
  // Use a dark gray for the trace lines
  tCtx.fillStyle = "#4B5563"; // Gray 600

  // Draw all letters onto the text canvas (Solid)
  let layoutY = currentY;
  letters.forEach(letter => {
     const pair = `${letter}${letter.toLowerCase()}`;
     const pairWithSpace = `${pair}    `;
     
     // Row 1
     let row1BaseY = layoutY + (rowHeight * 0.75);
     drawGuides(row1BaseY); // Draw guide on main ctx
     
     let textX = marginX + 20;
     while (textX + ctx.measureText(pair).width < width - marginX) {
        tCtx.fillText(pair, textX, row1BaseY - (fontSize * 0.05));
        textX += ctx.measureText(pairWithSpace).width;
     }
     layoutY += rowHeight;

     // Row 2
     let row2BaseY = layoutY + (rowHeight * 0.75);
     drawGuides(row2BaseY); // Draw guide on main ctx
     tCtx.fillText(pair, marginX + 20, row2BaseY - (fontSize * 0.05));
     layoutY += rowHeight;
  });

  // 4. Apply "Dashed" Mask to the Text Canvas
  // We use destination-out to erase diagonal strips from the text, creating dashes
  tCtx.globalCompositeOperation = 'destination-out';
  
  // Create the diagonal stripe pattern
  const pCanvas = document.createElement('canvas');
  const pSize = 16; // Pattern tile size
  pCanvas.width = pSize;
  pCanvas.height = pSize;
  const pCtx = pCanvas.getContext('2d');
  if (pCtx) {
    pCtx.strokeStyle = "black"; // Color irrelevant, only alpha matters
    pCtx.lineWidth = 4; // Width of the GAP
    pCtx.beginPath();
    // Diagonal line
    pCtx.moveTo(0, 0);
    pCtx.lineTo(pSize, pSize);
    pCtx.moveTo(pSize, 0); // Cross hatch or single? Single is cleaner for flow.
    // Let's do a single strong diagonal gap
    pCtx.stroke();
    
    // Add a second line to ensure continuity of pattern at edges if needed
    pCtx.beginPath();
    pCtx.moveTo(-pSize/2, -pSize/2);
    pCtx.lineTo(pSize * 1.5, pSize * 1.5);
    pCtx.stroke();
    
    const pattern = tCtx.createPattern(pCanvas, 'repeat');
    if (pattern) {
      tCtx.fillStyle = pattern;
      tCtx.fillRect(0, 0, width, height);
    }
  }

  // 5. Composite the Dashed Text onto the Main Background
  ctx.drawImage(textCanvas, 0, 0);

  return canvas.toDataURL("image/png");
};

/**
 * Processes a base64 image to add Color-by-Number segmentation and numbers.
 * Uses client-side Canvas pixel manipulation to identify white regions.
 */
const processColorByNumber = async (base64Image: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Though it's base64, good practice
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { resolve(base64Image); return; }

        // Set canvas size (original + footer space)
        const footerHeight = 150;
        canvas.width = img.width;
        canvas.height = img.height + footerHeight;

        // Fill white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // --- SEGMENTATION LOGIC ---
        const width = img.width;
        const height = img.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const visited = new Int8Array(width * height); // 0 = unvisited
        const regions: {x: number, y: number, size: number, id: number}[] = [];
        
        // Queue for BFS (pre-allocated for performance)
        const q = new Int32Array(width * height);
        
        // Iterate pixels
        // Step > 1 for performance finding seeds, but we need accurate fill
        for (let y = 10; y < height - 10; y += 4) {
          for (let x = 10; x < width - 10; x += 4) {
            const idx = y * width + x;
            if (visited[idx]) continue;

            // Check if white-ish
            if (data[idx * 4] < 200 || data[idx * 4 + 1] < 200 || data[idx * 4 + 2] < 200) {
              visited[idx] = 1; // Mark dark pixels as visited
              continue;
            }

            // Start Flood Fill
            let head = 0;
            let tail = 0;
            q[tail++] = idx;
            visited[idx] = 1;

            let count = 0;
            let sumX = 0;
            let sumY = 0;
            let minX = x, maxX = x, minY = y, maxY = y;

            while(head < tail) {
              const currIdx = q[head++];
              const cx = currIdx % width;
              const cy = Math.floor(currIdx / width);

              count++;
              sumX += cx;
              sumY += cy;
              
              // Bounding box
              if (cx < minX) minX = cx;
              if (cx > maxX) maxX = cx;
              if (cy < minY) minY = cy;
              if (cy > maxY) maxY = cy;

              // Check neighbors (4-way)
              const neighbors = [currIdx - 1, currIdx + 1, currIdx - width, currIdx + width];
              
              for (const nIdx of neighbors) {
                 if (nIdx >= 0 && nIdx < width * height && !visited[nIdx]) {
                    // Boundary check for wrapping
                    const nx = nIdx % width;
                    // Prevent wrapping around edges of image
                    if (Math.abs(nx - cx) > 1) continue; 

                    if (data[nIdx * 4] > 200 && data[nIdx * 4 + 1] > 200 && data[nIdx * 4 + 2] > 200) {
                       visited[nIdx] = 1;
                       q[tail++] = nIdx;
                    }
                 }
              }
            }

            // Process Region
            // Threshold: Region must be big enough (e.g. 0.1% of image or fixed pixel count)
            // 1024x1024 = 1M pixels. 1000 pixels is small but visible.
            if (count > 800) {
               const centerX = Math.floor(sumX / count);
               const centerY = Math.floor(sumY / count);
               
               // Naive interior check: is the centroid white?
               const cIdx = centerY * width + centerX;
               if (data[cIdx * 4] > 200) {
                  regions.push({
                    x: centerX, 
                    y: centerY, 
                    size: count,
                    id: Math.floor(Math.random() * 5) + 1 // Random 1-5
                  });
               }
            }
          }
        }

        // --- DRAW NUMBERS ---
        // Scale font size based on image size
        const fontSize = Math.max(14, Math.floor(width / 40)); 
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#6B7280"; // Cool Gray 500

        regions.forEach(r => {
           ctx.fillText(r.id.toString(), r.x, r.y);
        });

        // --- DRAW LEGEND ---
        const legendY = height + (footerHeight / 2);
        const legendColors = [
           {id: 1, label: "Red", color: "#EF4444"},
           {id: 2, label: "Blue", color: "#3B82F6"},
           {id: 3, label: "Green", color: "#22C55E"},
           {id: 4, label: "Yellow", color: "#EAB308"},
           {id: 5, label: "Purple", color: "#A855F7"},
        ];

        // Draw separator
        ctx.beginPath();
        ctx.moveTo(50, height + 20);
        ctx.lineTo(width - 50, height + 20);
        ctx.strokeStyle = "#E5E7EB";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `bold ${fontSize + 4}px Nunito, sans-serif`;
        ctx.fillStyle = "#111827";
        ctx.textAlign = "left";
        
        // Calculate layout
        const itemWidth = width / 6;
        let startX = (width - (itemWidth * 5)) / 2;

        legendColors.forEach((lc, i) => {
            const x = startX + (i * itemWidth);
            
            // Color Circle
            ctx.beginPath();
            ctx.arc(x, legendY, fontSize, 0, 2 * Math.PI);
            ctx.fillStyle = "white"; // Interior
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = lc.color; // Colored border
            ctx.stroke();

            // Number inside circle
            ctx.fillStyle = "#111827";
            ctx.textAlign = "center";
            ctx.fillText(lc.id.toString(), x, legendY + (fontSize * 0.1));

            // Label below
            ctx.font = `600 ${fontSize * 0.8}px Nunito, sans-serif`;
            ctx.fillStyle = "#4B5563";
            ctx.fillText(lc.label, x, legendY + fontSize * 2.5);
            
            // Reset font for next circle number
            ctx.font = `bold ${fontSize + 4}px Nunito, sans-serif`;
        });

        resolve(canvas.toDataURL("image/png"));

      } catch (e) {
        console.error("Error processing color by number", e);
        resolve(base64Image); // Return original on failure
      }
    };
    img.onerror = (e) => {
       console.error("Image load error", e);
       resolve(base64Image);
    };
    img.src = base64Image;
  });
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
      // For Color by Number, we now generate a CLEAN standard image first, 
      // then programmatically add the numbers and legend.
      // So we ask for a high-contrast, simple closed-shape image.
      prompt = `A clean, simple black and white coloring page.
      Subject: ${description}.
      Style: ${styleInstruction}.
      IMPORTANT: Use closed lines and distinct segments. High contrast black ink on white.
      NO shading, NO grayscale, NO gradients. Simple vector style line art.`;
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
    const finalBase64 = `data:${mimeType};base64,${base64Data}`;

    // POST-PROCESSING for Color By Number
    if (mode === 'number' && type === 'page') {
       return await processColorByNumber(finalBase64);
    }

    return finalBase64;

  } catch (error) {
    console.error("Error generating image:", error);
    throw new Error("Failed to generate image.");
  }
};