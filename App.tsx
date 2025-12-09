import React, { useState, useEffect } from 'react';
import { AppState, BookData, GeneratedImage, Scene } from './types';
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
  Baby
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

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.INPUT);
  const [theme, setTheme] = useState('');
  const [childName, setChildName] = useState('');
  const [pageCount, setPageCount] = useState(5);
  const [ageGroup, setAgeGroup] = useState('3-5');
  const [bookData, setBookData] = useState<BookData>({
    theme: '',
    childName: '',
    ageGroup: '',
    scenes: [],
    images: []
  });
  const [progress, setProgress] = useState(0); // 0 to 100
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Background decoration blobs - Updated to match new Indigo/Pink/Amber theme
  const blobs = [
    { color: '#6366F1', top: '-10%', left: '-10%', size: '600px' }, // Indigo
    { color: '#EC4899', bottom: '-10%', right: '-10%', size: '500px' }, // Pink
    { color: '#FBBF24', top: '40%', right: '15%', size: '300px' } // Amber
  ];

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme || !childName) return;

    setState(AppState.PLANNING);
    setStatusMessage("Dreaming up the story...");
    setError(null);

    try {
      // 1. Generate Scenes
      const scenes = await generateScenes(theme, pageCount, ageGroup);
      setBookData(prev => ({ ...prev, theme, childName, ageGroup, scenes }));
      
      // 2. Start Generation
      setState(AppState.GENERATING);
      await generateBookImages(scenes, theme, ageGroup);
      
    } catch (err) {
      console.error(err);
      setError("Something went wrong while dreaming up the book. Please try again!");
      setState(AppState.ERROR);
    }
  };

  const generateBookImages = async (scenes: Scene[], currentTheme: string, currentAge: string) => {
    const totalSteps = scenes.length + 1; // +1 for cover
    let completedSteps = 0;
    const newImages: GeneratedImage[] = [];

    const updateProgress = (msg: string) => {
      completedSteps++;
      setProgress(Math.round((completedSteps / totalSteps) * 100));
      setStatusMessage(msg);
    };

    try {
      // Generate Cover first
      setStatusMessage("Designing the cover...");
      const coverUrl = await generateImage(currentTheme, 'cover', currentAge);
      newImages.push({
        id: 'cover',
        url: coverUrl,
        description: `Cover for ${currentTheme}`,
        type: 'cover'
      });
      updateProgress("Cover complete! Drawing page 1...");

      // Generate Pages Sequentially to show progress clearly
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        setStatusMessage(`Drawing page ${i + 1} of ${scenes.length}: ${scene.description.substring(0, 30)}...`);
        
        const pageUrl = await generateImage(scene.description, 'page', currentAge);
        newImages.push({
          id: scene.id,
          url: pageUrl,
          description: scene.description,
          type: 'page'
        });
        
        updateProgress(i === scenes.length - 1 ? "Finishing touches..." : `Drawing page ${i + 2}...`);
      }

      setBookData(prev => ({ ...prev, images: newImages }));
      setState(AppState.PREVIEW);

    } catch (err) {
      console.error(err);
      setError("We couldn't finish drawing all the pages. Please try again.");
      setState(AppState.ERROR);
    }
  };

  const handleDownload = () => {
    generatePDF(bookData);
  };

  const handleReset = () => {
    setState(AppState.INPUT);
    setTheme('');
    setChildName('');
    setPageCount(5);
    setAgeGroup('3-5');
    setBookData({ theme: '', childName: '', ageGroup: '', scenes: [], images: [] });
    setProgress(0);
  };

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
                      placeholder="Choose an idea or type your own!"
                      className="w-full px-6 py-5 rounded-2xl bg-white border-2 border-slate-100 focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none text-xl transition-all shadow-sm group-hover:border-slate-200"
                      required
                    />
                    <datalist id="theme-ideas">
                      {THEME_IDEAS.map((idea) => (
                        <option key={idea} value={idea} />
                      ))}
                    </datalist>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none animate-pulse">
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

                {/* Page Count Input */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <label htmlFor="pageCount" className="block text-lg font-display font-bold mb-4 text-dark flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-white rounded-lg shadow-sm mr-3">
                         <Layers className="w-5 h-5 text-secondary" />
                      </div>
                      How many coloring pages?
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

                <Button 
                  type="submit" 
                  className="w-full text-xl py-6 shadow-xl shadow-primary/20 hover:shadow-primary/40"
                >
                  Create Magic Book <ChevronRight className="w-6 h-6" />
                </Button>
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
                  </div>
                  <div className="flex gap-4 mt-6 md:mt-0 w-full md:w-auto">
                    <Button variant="outline" onClick={handleReset} className="flex-1 md:flex-none">
                       <RefreshCcw className="w-4 h-4 mr-2" /> New Book
                    </Button>
                    <Button onClick={handleDownload} className="flex-1 md:flex-none bg-secondary hover:bg-pink-400 shadow-lg shadow-secondary/20">
                       <Download className="w-4 h-4 mr-2" /> Download PDF
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

        <footer className="text-center mt-12 text-slate-500 text-sm font-medium">
          <p className="flex items-center justify-center gap-2 opacity-70 hover:opacity-100 transition-opacity">
            Made with <span className="text-secondary animate-pulse">♥</span> using Gemini AI
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;