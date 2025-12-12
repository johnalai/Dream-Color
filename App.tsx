import React, { useState, useEffect, useRef } from 'react';
import { AppState, BookData, GeneratedImage, Scene, ColoringMode } from './types';
import { generateScenes, generateImage } from './services/geminiService';
import { generatePDF } from './services/pdfService';
import { Button } from './components/Button';
import { 
  Pencil, 
  Sparkles, 
  Download, 
  RefreshCcw, 
  BookOpen, 
  ChevronRight,
  Palette,
  CheckCircle2,
  Layers,
  Baby,
  Type,
  Hash,
  Image as ImageIcon,
  Save,
  Trash2,
  Play,
  PencilLine,
  X,
  Info,
  Printer,
  RotateCcw,
  Lightbulb
} from 'lucide-react';

const THEME_IDEAS = [
  "Space Dinosaurs",
  "Underwater Unicorns",
  "Robot City Adventures",
  "Magical Forest Fairies",
  "Super Hero Cats",
  "Pirate Treasure Hunt",
  "Jungle Safari Party",
  "Candy Kingdom",
  "Dragon School",
  "Farm Animals playing Sports",
  "Princesses in Space",
  "Monster Truck Rally",
  "Detective Dogs",
  "Circus Performers",
  "Enchanted Castle",
  "Baby Dragons",
  "Construction Site Chaos",
  "Picnic on the Moon",
  "Camping with Bears",
  "Time Traveling Kids",
  "The 4 Seasons",
  "Occupations (Doctor, Firefighter)",
  "Insects World",
  "Happy Monsters",
  "Transportation (Trains, Planes, Cars)"
];

const AGE_GROUPS = [
  { id: '1-3', label: 'Toddler (1-3)', desc: 'Large shapes, very simple' },
  { id: '3-5', label: 'Preschool (3-5)', desc: 'Cute, simple scenes' },
  { id: '5-8', label: 'School Age (5-8)', desc: 'More details & action' },
  { id: '9+', label: 'Big Kid (9+)', desc: 'Intricate & complex' }
];

const FONTS = [
  { id: 'helvetica', label: 'Classic', family: 'Nunito, sans-serif' },
  { id: 'chewy', label: 'Playful', family: 'Chewy, cursive' },
  { id: 'bangers', label: 'Comic', family: 'Bangers, cursive' },
  { id: 'patrick', label: 'Handwritten', family: 'Patrick Hand, cursive' }
];

const COLORING_MODES: { id: ColoringMode; label: string; icon: React.ReactNode; desc: string; tooltip: string }[] = [
  { 
    id: 'standard', 
    label: 'Standard', 
    icon: <ImageIcon className="w-5 h-5" />, 
    desc: 'Classic outlines',
    tooltip: 'Beautiful, clean line art scenes perfect for crayons and markers.'
  },
  { 
    id: 'number', 
    label: 'By Number', 
    icon: <Hash className="w-5 h-5" />, 
    desc: 'Segments with numbers',
    tooltip: 'Number-coded regions (1-5) with a color key at the bottom.'
  },
  { 
    id: 'letter', 
    label: 'By Letter', 
    icon: <Type className="w-5 h-5" />, 
    desc: 'Segments with letters',
    tooltip: 'Letter-coded regions (A-E) to practice alphabet recognition.'
  },
  { 
    id: 'trace', 
    label: 'Trace Letters', 
    icon: <PencilLine className="w-5 h-5" />, 
    desc: 'Alphabet practice',
    tooltip: 'Handwriting worksheets for practicing letter formation.'
  },
];

const STORAGE_KEY = 'dreamcolor_save_v1';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.INPUT);
  const [theme, setTheme] = useState('');
  const [childName, setChildName] = useState('');
  const [pageCount, setPageCount] = useState(5);
  const [ageGroup, setAgeGroup] = useState('3-5');
  const [selectedFont, setSelectedFont] = useState('chewy');
  const [coloringMode, setColoringMode] = useState<ColoringMode>('standard');
  const [bookData, setBookData] = useState<BookData>({
    theme: '',
    childName: '',
    ageGroup: '',
    fontId: '',
    coloringMode: 'standard',
    scenes: [],
    images: []
  });
  const [progress, setProgress] = useState(0); // 0 to 100
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Suggestions state
  const [isThemeFocused, setIsThemeFocused] = useState(false);
  const [suggestedThemes, setSuggestedThemes] = useState<string[]>([]);

  // Background decoration blobs
  const blobs = [
    { color: '#6366F1', top: '-10%', left: '-10%', size: '600px' }, 
    { color: '#EC4899', bottom: '-10%', right: '-10%', size: '500px' }, 
    { color: '#FBBF24', top: '40%', right: '15%', size: '300px' } 
  ];

  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        
        // Restore basic fields
        if (data.theme) setTheme(data.theme);
        if (data.childName) setChildName(data.childName);
        if (data.pageCount) setPageCount(data.pageCount);
        if (data.ageGroup) setAgeGroup(data.ageGroup);
        if (data.selectedFont) setSelectedFont(data.selectedFont);
        if (data.coloringMode) setColoringMode(data.coloringMode);
        if (data.bookData) setBookData(data.bookData);

        // Smart State Restoration
        if (data.state === AppState.PREVIEW) {
          setState(AppState.PREVIEW);
        } else if (data.state === AppState.GENERATING || data.state === AppState.PLANNING) {
          // If we were generating, go to input but enable "Resume"
          // Or if we have data, we can stay in INPUT but show resume options
          // If scenes are generated but images are missing, we are "Paused"
          if (data.bookData?.scenes?.length > 0 && data.bookData?.images?.length < data.bookData?.scenes?.length + 1) {
             setHasSavedData(true);
             setStatusMessage("Previous session found.");
             // We stay in INPUT but the form will adapt
          }
        }
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        const data = {
          state, 
          theme, 
          childName, 
          pageCount, 
          ageGroup, 
          selectedFont, 
          coloringMode, 
          bookData,
          timestamp: Date.now()
        };
        // Avoid saving if state is ERROR
        if (state !== AppState.ERROR) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch (e) {
        console.warn("Storage quota exceeded or error saving", e);
        // We could show a toast here, but console warn is enough for now
      }
    }, 1000); // Debounce save

    return () => clearTimeout(timeoutId);
  }, [state, theme, childName, pageCount, ageGroup, selectedFont, coloringMode, bookData]);

  // Suggestion Rotation Logic
  useEffect(() => {
    if (isThemeFocused) {
      const shuffle = () => {
        // Pick 3 random
        const shuffled = [...THEME_IDEAS].sort(() => 0.5 - Math.random());
        setSuggestedThemes(shuffled.slice(0, 3));
      };
      
      shuffle(); // Initial shuffle
      const interval = setInterval(shuffle, 3500); // Rotate every 3.5s
      return () => clearInterval(interval);
    }
  }, [isThemeFocused]);

  const clearSave = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHasSavedData(false);
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme || !childName) return;

    // Check if we are resuming
    const isResuming = bookData.scenes.length > 0 && bookData.theme === theme && bookData.childName === childName;
    
    setError(null);
    setState(AppState.PLANNING); // Briefly show planning/loading
    
    try {
      let scenesToUse = bookData.scenes;

      // Only generate scenes if we aren't resuming or don't have them
      if (!isResuming || scenesToUse.length === 0) {
        setStatusMessage("Dreaming up the story...");
        // Updated call: added coloringMode as 4th argument
        scenesToUse = await generateScenes(theme, pageCount, ageGroup, coloringMode);
        
        setBookData(prev => ({ 
          ...prev, 
          theme, 
          childName, 
          ageGroup, 
          fontId: selectedFont,
          coloringMode,
          scenes: scenesToUse,
          images: [] // Reset images if new scenes
        }));
      } else {
        setStatusMessage("Resuming your book...");
      }
      
      // 2. Start Generation
      setState(AppState.GENERATING);
      
      // Pass existing images if resuming
      const currentImages = isResuming ? bookData.images : [];
      await generateBookImages(scenesToUse, theme, ageGroup, coloringMode, currentImages, selectedFont);
      
    } catch (err) {
      console.error(err);
      setError("Something went wrong while dreaming up the book. Please try again!");
      setState(AppState.ERROR);
    }
  };

  const generateBookImages = async (
    scenes: Scene[], 
    currentTheme: string, 
    currentAge: string, 
    mode: ColoringMode,
    existingImages: GeneratedImage[],
    fontId: string
  ) => {
    const totalSteps = scenes.length + 1; // +1 for cover
    
    // Calculate initial progress based on existing images
    let completedCount = existingImages.length;
    setProgress(Math.round((completedCount / totalSteps) * 100));

    const updateProgress = (msg: string) => {
      // Intentionally not incrementing here, we increment after success logic
      setStatusMessage(msg);
    };

    try {
      // 1. Generate Cover (if missing)
      const hasCover = existingImages.some(img => img.type === 'cover');
      
      if (!hasCover) {
        setStatusMessage("Designing the cover...");
        const coverUrl = await generateImage(currentTheme, 'cover', currentAge, mode, fontId);
        
        const coverImage: GeneratedImage = {
          id: 'cover',
          url: coverUrl,
          description: `Cover for ${currentTheme}`,
          type: 'cover'
        };
        
        // Update state incrementally to allow saving progress
        setBookData(prev => {
          const updated = { ...prev, images: [...prev.images, coverImage] };
          return updated;
        });
        
        completedCount++;
        setProgress(Math.round((completedCount / totalSteps) * 100));
        updateProgress("Cover complete! Moving to pages...");
      }

      // 2. Generate Pages (skip existing)
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const hasPage = existingImages.some(img => img.id === scene.id); // Check passed arg
        // Also check current state (via ref or just re-checking state would be complex in loop)
        // We rely on the fact that existingImages was accurate at start, and we are running sequentially.
        
        if (hasPage) {
           // update progress visual just in case
           updateProgress(`Checking page ${i + 1}...`);
           continue;
        }

        setStatusMessage(`Drawing page ${i + 1} of ${scenes.length}: ${scene.description.substring(0, 30)}...`);
        
        const pageUrl = await generateImage(scene.description, 'page', currentAge, mode, fontId);
        const pageImage: GeneratedImage = {
          id: scene.id,
          url: pageUrl,
          description: scene.description,
          type: 'page'
        };
        
        // Update State incrementally
        setBookData(prev => ({ ...prev, images: [...prev.images, pageImage] }));
        
        completedCount++;
        setProgress(Math.round((completedCount / totalSteps) * 100));
      }
      
      updateProgress("Finishing touches...");
      // Small delay to let user see 100%
      await new Promise(r => setTimeout(r, 500));

      setState(AppState.PREVIEW);

    } catch (err) {
      console.error(err);
      setError("We couldn't finish drawing all the pages. Please try again.");
      setState(AppState.ERROR);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await generatePDF(bookData);
    } catch (e) {
      console.error("PDF Generation failed", e);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print.");
      return;
    }

    // Determine font family
    const fontMap: Record<string, string> = {
      'helvetica': 'Nunito, sans-serif',
      'chewy': 'Chewy, cursive',
      'bangers': 'Bangers, cursive',
      'patrick': 'Patrick Hand, cursive'
    };
    const titleFontFamily = fontMap[bookData.fontId] || 'Nunito, sans-serif';

    // Heuristics for Title Size (Dynamic)
    const titleLen = bookData.theme.length;
    let titleFontSize = '48px';
    if (titleLen > 15) titleFontSize = '36px';
    if (titleLen > 25) titleFontSize = '28px';

    // Heuristics for Name Size
    const nameLen = bookData.childName.length;
    let nameFontSize = '24px';
    if (nameLen > 15) nameFontSize = '20px';
    if (nameLen > 25) nameFontSize = '16px';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>DreamColor - ${bookData.theme}</title>
          <style>
            @page { size: A4 portrait; margin: 0; }
            body { margin: 0; padding: 0; font-family: 'Nunito', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #eee; }
            .page-wrapper {
              display: flex;
              justify-content: center;
              padding: 20px 0;
            }
            .page { 
              width: 210mm; 
              height: 296mm; 
              position: relative; 
              page-break-after: always; 
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              overflow: hidden;
              background: white;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            @media print {
              body { background: white; }
              .page-wrapper { padding: 0; display: block; }
              .page { box-shadow: none; width: 100%; height: 100%; page-break-after: always; }
            }
            .page:last-child { page-break-after: auto; }
            
            .cover-container {
              position: relative;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: flex-end; /* Changed from center to flex-end */
              justify-content: center;
              overflow: hidden;
              padding-bottom: 40px; /* Added spacing for bottom alignment */
              box-sizing: border-box;
            }
            .cover-bg {
              position: absolute;
              top: 0; left: 0; width: 100%; height: 100%;
              object-fit: cover;
              z-index: 0;
            }
            .cover-overlay {
              position: relative;
              z-index: 10;
              background: transparent;
              padding: 40px;
              text-align: center;
              width: 80%;
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .cover-title { 
              font-family: ${titleFontFamily};
              font-size: ${titleFontSize}; 
              font-weight: 800; 
              color: #1E293B; 
              margin: 0; 
              line-height: 1.1; 
              text-transform: uppercase; 
              text-shadow: 2px 2px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
            }
            .cover-subtitle { 
              font-size: 32px; 
              color: #EC4899; 
              margin: 0; 
              font-weight: 700; 
              font-family: 'Nunito', sans-serif;
              text-shadow: 2px 2px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
            }
            .cover-artist { 
              font-size: ${nameFontSize}; 
              color: #6366F1; 
              margin-top: 10px; 
              font-weight: 600; 
              font-family: 'Nunito', sans-serif;
              text-shadow: 2px 2px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff;
            }

            .coloring-page-img {
              max-width: 90%;
              max-height: 90%;
              object-fit: contain;
            }
            .page-footer {
              position: absolute;
              bottom: 20px;
              font-size: 14px;
              color: #94A3B8;
              text-align: right; /* Changed from center to right */
              width: 100%;
              padding-right: 40px; /* Added padding to ensure it's not on the edge */
              box-sizing: border-box;
            }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Bangers&family=Chewy&family=Patrick+Hand&display=swap" rel="stylesheet">
        </head>
        <body>
          ${bookData.images.map((img, i) => {
            if (img.type === 'cover') {
              return `
                <div class="page-wrapper">
                  <div class="page">
                    <div class="cover-container">
                      <img src="${img.url}" class="cover-bg" />
                      <div class="cover-overlay">
                        <h1 class="cover-title">${bookData.theme}</h1>
                        <h2 class="cover-subtitle">Coloring Book</h2>
                        <div class="cover-artist">Created for ${bookData.childName}</div>
                      </div>
                    </div>
                  </div>
                </div>
              `;
            } else {
              return `
                <div class="page-wrapper">
                  <div class="page">
                    <img src="${img.url}" class="coloring-page-img" />
                    <div class="page-footer">${i}</div>
                  </div>
                </div>
              `;
            }
          }).join('')}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 1000);
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handleReset = () => {
    if (confirm("Are you sure? This will clear your current book and progress.")) {
      clearSave();
      setState(AppState.INPUT);
      setTheme('');
      setChildName('');
      setPageCount(5);
      // setAgeGroup('3-5'); // Keep preferences
      setBookData({ 
        theme: '', 
        childName: '', 
        ageGroup: '', 
        fontId: selectedFont, 
        coloringMode: coloringMode,
        scenes: [], 
        images: [] 
      });
      setProgress(0);
      setError(null);
    }
  };

  const isResumable = bookData.scenes.length > 0 && bookData.theme === theme;

  return (
    <div className="min-h-screen relative overflow-hidden font-sans text-dark bg-light selection:bg-primary/20 selection:text-primary">
      {/* Background Blobs */}
      {blobs.map((blob, i) => (
        <div 
          key={i}
          className="blob-shape rounded-full absolute"
          style={{
            backgroundColor: blob.color,
            top: blob.top,
            left: blob.left,
            bottom: blob.bottom,
            right: blob.right,
            width: blob.size,
            height: blob.size,
          }}
        />
      ))}

      {/* About Modal */}
      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowAbout(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 relative" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setShowAbout(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="text-center mb-6">
               <div className="bg-primary/10 p-3 rounded-xl inline-flex mb-4">
                  <Palette className="w-8 h-8 text-primary" />
               </div>
               <h2 className="text-2xl font-display font-bold text-dark">About DreamColor</h2>
            </div>
            
            <div className="space-y-4 text-slate-600 leading-relaxed text-sm md:text-base">
              <p>
                Welcome to <strong className="text-primary">DreamColor</strong>! We believe every child deserves a coloring book where they are the star.
              </p>
              <p>
                This application harnesses the power of <strong className="text-secondary">Google's Gemini AI</strong> to instantly imagine and draw unique coloring pages based on your specific themes and interests.
              </p>
              <p>
                Whether it's "Space Dinosaurs" or "Underwater Unicorns", our AI generates safe, age-appropriate line art specifically designed for your child's age group.
              </p>
            </div>

            <div className="mt-8 text-center">
              <Button onClick={() => setShowAbout(false)} className="w-full">
                Got it!
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* START OVER BUTTON (Reset) */}
      {state !== AppState.INPUT && (
        <div className="absolute top-4 right-4 md:top-6 md:right-6 z-20">
           <Button 
             variant="outline" 
             onClick={handleReset} 
             className="bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white text-xs md:text-sm py-2 px-3 rounded-xl border-slate-200"
           >
             <RotateCcw className="w-4 h-4 mr-2" /> Start Over
           </Button>
        </div>
      )}

      <div className="relative z-10 container mx-auto px-4 py-8 md:py-16 max-w-5xl">
        {/* Header */}
        <header className="text-center mb-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm rounded-3xl shadow-lg mb-6 ring-1 ring-white/50">
            <div className="bg-primary/10 p-2 rounded-xl mr-3">
              <Palette className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display text-4xl md:text-5xl font-bold text-dark tracking-tight">
              Dream<span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">Color</span>
            </h1>
          </div>
          <p className="text-lg md:text-xl text-slate-600 font-medium max-w-xl mx-auto mt-2 leading-relaxed">
            Create magical, personalized coloring books for your little artists in seconds.
          </p>
        </header>

        {/* Content Area */}
        <main className="bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-indigo-500/10 border border-white/50 p-6 md:p-12 min-h-[400px] transition-all duration-500 relative overflow-hidden">
          
          {/* Decorative Corner */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-secondary/5 to-primary/5 rounded-bl-[4rem] -z-0 pointer-events-none"></div>

          {/* STATE: INPUT */}
          {state === AppState.INPUT && (
            <div className="max-w-xl mx-auto animate-fadeIn relative z-10">
              
              {isResumable && (
                <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-full text-primary">
                      <Save className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-dark">Unfinished book found!</p>
                      <p className="text-sm text-slate-600">
                        {bookData.images.length} of {bookData.scenes.length + 1} pages ready.
                      </p>
                    </div>
                  </div>
                  <Button 
                     type="button" 
                     variant="secondary" 
                     className="py-2 px-4 text-sm"
                     onClick={handleStart}
                  >
                    Resume <Play className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              <form onSubmit={handleStart} className="space-y-8">
                
                {/* Child Name Input */}
                <div>
                  <label htmlFor="childName" className="block text-xl font-display font-bold mb-3 text-dark">
                    Who is this book for?
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      id="childName"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                      placeholder="e.g. Leo, Maya, Charlie"
                      className="w-full px-6 py-5 rounded-2xl bg-white border-2 border-slate-100 focus:border-secondary focus:ring-4 focus:ring-secondary/20 outline-none text-xl transition-all shadow-sm group-hover:border-slate-200"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
                      <BookOpen className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Theme Input */}
                <div>
                  <label htmlFor="theme" className="block text-xl font-display font-bold mb-3 text-dark">
                    What should the book be about?
                  </label>
                  <div className="relative group">
                    <input
                      type="text"
                      id="theme"
                      list="theme-ideas"
                      value={theme}
                      onChange={(e) => setTheme(e.target.value)}
                      onFocus={() => setIsThemeFocused(true)}
                      onBlur={() => setTimeout(() => setIsThemeFocused(false), 200)}
                      placeholder="Choose an idea or type your own!"
                      className="w-full px-6 py-5 rounded-2xl bg-white border-2 border-slate-100 focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none text-xl transition-all shadow-sm group-hover:border-slate-200 z-10 relative"
                      required
                    />
                    {/* Rotating Suggestions Carousel */}
                    <div className={`absolute top-full left-0 right-0 mt-3 p-4 bg-white rounded-2xl shadow-xl shadow-indigo-100 border border-indigo-50 z-20 transition-all duration-300 transform origin-top ${isThemeFocused ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95 pointer-events-none'}`}>
                       <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
                         <Lightbulb className="w-3 h-3 text-accent" />
                         Inspiration Station
                       </div>
                       <div className="flex flex-wrap gap-2">
                         {suggestedThemes.map((s, idx) => (
                           <button
                             key={`${s}-${idx}`}
                             type="button"
                             onClick={() => setTheme(s)}
                             className="text-sm px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 hover:scale-105 transition-all duration-200 animate-fadeIn"
                             style={{ animationDelay: `${idx * 100}ms` }}
                           >
                             {s}
                           </button>
                         ))}
                       </div>
                    </div>
                    
                    <datalist id="theme-ideas">
                      {THEME_IDEAS.map((idea) => (
                        <option key={idea} value={idea} />
                      ))}
                    </datalist>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none animate-pulse z-30">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* Age Selection */}
                <div>
                   <label className="block text-xl font-display font-bold mb-3 text-dark">
                    How old is the artist?
                  </label>
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    {AGE_GROUPS.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setAgeGroup(group.id)}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 text-left relative overflow-hidden ${
                          ageGroup === group.id
                            ? 'border-secondary bg-secondary/5 ring-1 ring-secondary'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                         <div className="font-bold text-dark text-lg mb-1">{group.label}</div>
                         <div className="text-xs text-slate-500">{group.desc}</div>
                         {ageGroup === group.id && (
                           <div className="absolute top-3 right-3 text-secondary">
                             <CheckCircle2 className="w-5 h-5" />
                           </div>
                         )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coloring Mode Selection */}
                <div>
                  <label className="block text-xl font-display font-bold mb-3 text-dark">
                    Coloring Mode
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {COLORING_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          setColoringMode(mode.id);
                          // Default page count logic
                          if (mode.id === 'trace') {
                            setPageCount(10);
                          } else {
                            setPageCount(5);
                          }
                        }}
                        className={`group p-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center text-center relative ${
                          coloringMode === mode.id
                            ? 'border-accent bg-accent/5 ring-1 ring-accent'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                         {/* Tooltip */}
                         <div className="absolute bottom-full mb-2 w-48 p-2 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg">
                           {mode.tooltip}
                           {/* Arrow */}
                           <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                         </div>

                         <div className={`mb-2 p-2 rounded-full ${coloringMode === mode.id ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'}`}>
                           {mode.icon}
                         </div>
                         <div className="font-bold text-dark text-sm">{mode.label}</div>
                         <div className="text-[10px] text-slate-500 leading-tight mt-1">{mode.desc}</div>
                         
                         {coloringMode === mode.id && (
                           <div className="absolute top-2 right-2 text-accent">
                             <CheckCircle2 className="w-4 h-4" />
                           </div>
                         )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Selection */}
                <div>
                  <label className="block text-xl font-display font-bold mb-3 text-dark">
                    Choose a font style
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {FONTS.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => setSelectedFont(font.id)}
                        className={`group p-4 rounded-2xl border-2 transition-all duration-300 relative flex flex-col items-center justify-center gap-2 h-32 ${
                          selectedFont === font.id
                            ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-sm'
                            : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-md'
                        }`}
                      >
                        <span 
                          className="text-4xl text-dark transition-transform duration-300 group-hover:scale-110"
                          style={{ fontFamily: font.family }}
                        >
                          {childName ? (childName.length > 10 ? "Aa" : childName) : "Aa"}
                        </span>
                        <span className="text-xs text-slate-400 font-sans font-bold tracking-wider uppercase">
                          {font.label}
                        </span>
                        {selectedFont === font.id && (
                          <div className="absolute top-2 right-2 text-primary bg-white rounded-full p-0.5 shadow-sm">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Page Count Input */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <label htmlFor="pageCount" className="block text-lg font-display font-bold mb-4 text-dark flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-white rounded-lg shadow-sm mr-3">
                         <Layers className="w-5 h-5 text-secondary" />
                      </div>
                      How many coloring pages?
                      
                      {/* Tooltip added here */}
                      <div className="group relative ml-2">
                        <Info className="w-5 h-5 text-slate-400 cursor-help" />
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs font-normal rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-lg text-center">
                          More pages take longer to create (approx. 5-10s per page).
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                        </div>
                      </div>

                    </div>
                    <span className="font-display font-bold text-3xl text-primary">
                      {pageCount}
                    </span>
                  </label>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-400">3</span>
                    <input 
                      type="range" 
                      min="3" 
                      max="10" 
                      step="1"
                      value={pageCount}
                      onChange={(e) => setPageCount(parseInt(e.target.value))}
                      className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary hover:accent-secondary transition-all"
                    />
                    <span className="text-sm font-bold text-slate-400">10</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  {hasSavedData && (
                     <Button 
                       type="button" 
                       variant="outline" 
                       className="px-4"
                       onClick={clearSave}
                       title="Clear saved data"
                     >
                       <Trash2 className="w-5 h-5" />
                     </Button>
                  )}
                  <Button 
                    type="submit" 
                    className="flex-1 text-xl py-6 shadow-xl shadow-primary/20 hover:shadow-primary/40"
                  >
                    {isResumable ? "Resume Book" : "Create Magic Book"} <ChevronRight className="w-6 h-6" />
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* STATE: PLANNING & GENERATING */}
          {(state === AppState.PLANNING || state === AppState.GENERATING) && (
            <div className="max-w-2xl mx-auto text-center py-12 animate-fadeIn">
              <div className="mb-12 relative">
                <div className="w-40 h-40 mx-auto bg-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-100 relative z-10 border-4 border-slate-50">
                  <Pencil className="w-20 h-20 text-secondary animate-bounce" />
                </div>
                <div className="absolute top-1/2 left-0 right-0 h-6 bg-slate-100 rounded-full -z-0 overflow-hidden mx-8 shadow-inner">
                   <div 
                    className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-700 ease-out relative"
                    style={{ width: `${progress}%` }}
                   >
                     <div className="absolute inset-0 bg-white/20 animate-[shimmer_2s_infinite]"></div>
                   </div>
                </div>
              </div>

              <h2 className="text-4xl font-display font-bold mb-4 text-dark">
                {state === AppState.PLANNING ? "Dreaming..." : "Drawing..."}
              </h2>
              <p className="text-xl text-slate-500 mb-10 font-medium">{statusMessage}</p>

              <div className="flex flex-wrap justify-center gap-3">
                 {[...Array(pageCount + 1)].map((_, i) => (
                    <div 
                      key={i} 
                      className={`w-4 h-4 rounded-full transition-all duration-500 transform ${
                        (progress / 100) * (pageCount + 1) > i 
                          ? 'bg-secondary scale-110 shadow-lg shadow-secondary/30' 
                          : 'bg-slate-200'
                      }`}
                      title={i === 0 ? "Cover" : `Page ${i}`}
                    />
                 ))}
              </div>
            </div>
          )}

          {/* STATE: PREVIEW */}
          {state === AppState.PREVIEW && (
            <div className="animate-fadeIn">
               <div className="flex flex-col md:flex-row justify-between items-end mb-10 pb-8 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-green-100 rounded-full">
                         <CheckCircle2 className="w-6 h-6 text-green-600" />
                       </div>
                       <h2 className="text-3xl font-display font-bold text-dark">
                        Your Book is Ready!
                      </h2>
                    </div>
                    <p className="text-slate-500 text-lg">
                      Previewing <span className="font-bold text-dark">{bookData.theme}</span> for <span className="font-bold text-dark">{bookData.childName}</span>
                    </p>
                    <div className="flex gap-2 mt-2">
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                         {bookData.scenes.length} Pages
                       </span>
                       {bookData.coloringMode !== 'standard' && (
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent-700">
                           Color by {bookData.coloringMode === 'number' ? 'Number' : bookData.coloringMode === 'letter' ? 'Letter' : 'Trace'}
                         </span>
                       )}
                       {hasSavedData && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                             Saved
                          </span>
                       )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-6 md:mt-0 w-full md:w-auto">
                    {/* Replaced 'New Book' with 'Start Over' at top right, so just Download/Print here */}
                    <Button 
                      onClick={handlePrint}
                      className="flex-1 md:flex-none bg-primary hover:bg-indigo-600 shadow-lg shadow-primary/20"
                    >
                      <Printer className="w-4 h-4 mr-2" /> Print All
                    </Button>
                    <Button 
                      onClick={handleDownload} 
                      className="flex-1 md:flex-none bg-secondary hover:bg-pink-400 shadow-lg shadow-secondary/20"
                      isLoading={isDownloading}
                      disabled={isDownloading}
                    >
                       <Download className="w-4 h-4 mr-2" /> {isDownloading ? "Generating..." : "Download PDF"}
                    </Button>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-4">
                  {/* Cover Preview */}
                  {bookData.images.filter(img => img.type === 'cover').map((img) => (
                    <div key={img.id} className="group relative aspect-[3/4] bg-white rounded-2xl shadow-lg overflow-hidden ring-4 ring-offset-4 ring-primary/20 hover:ring-primary/40 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300">
                      <img src={img.url} alt="Cover" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-dark/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                         <span className="inline-block self-start px-3 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-bold rounded-full mb-2 border border-white/30">BOOK COVER</span>
                      </div>
                    </div>
                  ))}

                  {/* Pages Preview */}
                  {bookData.images.filter(img => img.type === 'page').map((img, idx) => (
                    <div key={img.id} className="group relative aspect-[3/4] bg-white rounded-2xl shadow-md overflow-hidden border-2 border-slate-100 hover:border-secondary hover:shadow-xl hover:shadow-secondary/10 transition-all duration-300">
                      <div className="absolute inset-0 p-6 flex items-center justify-center bg-white">
                        <img src={img.url} alt={`Page ${idx + 1}`} className="max-w-full max-h-full object-contain filter contrast-125" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-4 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                         <div className="flex justify-between items-center mb-1">
                           <span className="text-xs font-bold text-secondary uppercase tracking-wider bg-secondary/10 px-2 py-0.5 rounded-full">Page {idx + 1}</span>
                         </div>
                         <p className="text-sm text-slate-700 leading-snug line-clamp-2">{img.description}</p>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {/* STATE: ERROR */}
          {state === AppState.ERROR && (
             <div className="text-center py-20 animate-fadeIn">
               <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-red-100 shadow-xl">
                 <span className="text-4xl">😕</span>
               </div>
               <h2 className="text-3xl font-display font-bold text-dark mb-4">
                 Oops!
               </h2>
               <p className="text-xl text-slate-600 mb-8 max-w-md mx-auto">
                 {error || "Something unexpected happened."}
               </p>
               <Button onClick={handleReset} variant="secondary">
                 Try Again
               </Button>
             </div>
          )}

        </main>

        <footer className="text-center mt-12 text-slate-500 text-sm font-medium pb-8">
          <p className="flex items-center justify-center gap-2 opacity-70 mb-4">
            Made with <span className="text-secondary animate-pulse">♥</span> using Gemini AI
          </p>
          <button 
            onClick={() => setShowAbout(true)}
            className="text-slate-400 hover:text-primary transition-colors underline underline-offset-4"
          >
            About DreamColor
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;