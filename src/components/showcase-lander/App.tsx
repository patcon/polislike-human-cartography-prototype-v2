import React, { useState, useEffect, useCallback, useRef } from 'react';
import HomePage from './HomePage';
import ParameterExplorerApp from '@/components/param-explorer/ParameterExplorerApp';
import { App as PerspectiveMapApp } from '@/components/convo-explorer/App';
import type { PreloadedData } from '@/components/convo-explorer/App';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft } from 'lucide-react';

type CurrentPage = 'home' | 'parameter-explorer' | 'perspective-explorer';

const App: React.FC = () => {
  // Initialize page based on URL hash
  const getInitialPage = (): CurrentPage => {
    const hash = window.location.hash.slice(1); // Remove the '#'
    if (hash === 'perspective-explorer') {
      return 'perspective-explorer';
    }
    if (hash === 'parameter-explorer') {
      return 'parameter-explorer';
    }
    return 'home';
  };

  const [currentPage, setCurrentPage] = useState<CurrentPage>(getInitialPage);

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      setCurrentPage(getInitialPage());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (page: 'parameter-explorer' | 'perspective-explorer') => {
    setCurrentPage(page);
    // Update URL hash
    window.location.hash = page;
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    // Clear the URL hash when returning to home
    window.location.hash = '';
  };

  // --- h5ad file loading for perspective explorer ---
  const [h5adData, setH5adData] = useState<PreloadedData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const { loadH5adFile } = await import('@/lib/h5ad-loader');
      const buffer = await file.arrayBuffer();
      const parsed = await loadH5adFile(buffer);
      setH5adData({
        dataset: parsed.dataset,
        statements: parsed.statements,
        votesRows: parsed.votesRows,
        pipelineData: parsed.allEmbeddings,
        fullDimensionEmbeddings: parsed.fullDimensionEmbeddings,
      });
    } catch (err) {
      console.error('Failed to load h5ad file:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // Render the appropriate component based on current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'parameter-explorer':
        return <ParameterExplorerApp />;
      case 'perspective-explorer':
        return <PerspectiveMapApp preloadedData={h5adData ?? undefined} onLoadFile={handleLoadFile} />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="relative">
      {/* Hidden file input for h5ad loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".h5ad,.h5,.hdf5"
        onChange={handleFileChange}
        className="sr-only"
      />

      {/* Back to Home Button - Only show when not on home page */}
      {currentPage !== 'home' && (
        <Button
          onClick={handleBackToHome}
          className="fixed top-12 left-4 z-[50] flex items-center gap-2 bg-white/90 backdrop-blur-sm text-slate-700 border border-slate-200 hover:bg-white hover:shadow-md transition-all h-9"
          variant="outline"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Home</span>
        </Button>
      )}

      {/* Current Page Content */}
      {renderCurrentPage()}
    </div>
  );
};

export default App;