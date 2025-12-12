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
      const rangeLabel = `${pageLetters[0]}-${pageLetters[pageLetters.length - 1]}`;
      
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
  mode: ColoringMode = 'standard'
): Promise<string> => {
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
    } else if (mode === 'trace') {
      // Extract letters from description "Handwriting practice for letters: A, B, C" -> "A, B, C"
      const letters = description.replace("Handwriting practice for letters: ", "");
      
      prompt = `A black and white educational handwriting worksheet.
      Layout: Horizontal ruled handwriting lines.
      Header: Include "Name: _______________" at the very top.
      Content: Handwriting practice for these letters: ${letters}.
      
      STRICT STRUCTURE FOR EACH LETTER (Repeat this pattern for every assigned letter):
      1. First Line: The uppercase and lowercase letter (e.g., 'A a') repeated across the entire line in DOTTED/DASHED font for tracing.
      2. Second Line: The uppercase and lowercase letter (e.g., 'A a') appearing ONCE at the start in DOTTED font, followed by empty ruled space for the rest of the line.
      
      Constraint: NO PICTURES. NO ILLUSTRATIONS. NO CARTOONS. Text and lines only.
      Style: Clean, minimalist, academic worksheet. High contrast black and white.`;
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