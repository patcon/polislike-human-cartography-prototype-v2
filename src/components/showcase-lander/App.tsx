import React, { useState, useEffect } from 'react';
import HomePage from './HomePage';
import ParameterExplorerApp from '@/components/param-explorer/ParameterExplorerApp';
import { App as PerspectiveMapApp } from '@/components/convo-explorer/App';
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
  };

  // Render the appropriate component based on current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={handleNavigate} />;
      case 'parameter-explorer':
        return <ParameterExplorerApp />;
      case 'perspective-explorer':
        return <PerspectiveMapApp />;
      default:
        return <HomePage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="relative">
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