import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Map, ArrowRight } from 'lucide-react';
import { ConversationListing } from './ConversationListing';
import { useConversations } from './useConversations';

interface HomePageProps {
  onNavigate: (page: 'parameter-explorer' | 'perspective-explorer') => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { conversations, loading, error } = useConversations();

  const scrollToConversations = () => {
    const conversationSection = document.querySelector('.conversation-showcase-section');
    if (conversationSection) {
      conversationSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">
            Human Cartography Tools
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Explore conversation data through interactive visualizations and parameter configuration tools
          </p>
        </div>

        {/* Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">

          {/* Perspective Map Explorer Card - Top on mobile, Left on desktop */}
          <Card
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-blue-300 bg-white flex flex-col"
            onClick={() => onNavigate('perspective-explorer')}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                  <Map className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-slate-800">
                  Perspective Map Explorer
                </CardTitle>
              </div>
              <CardDescription className="text-slate-600">
                Interactive visualization of participant opinions and voting patterns through dynamic maps and clustering tools
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="space-y-3 mb-6 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Visualize opinion clusters</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Paint and group participants</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Explore voting patterns</span>
                </div>
              </div>
              <div className="space-y-2 mt-auto">
                <Button
                  className="w-full group-hover:bg-blue-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('perspective-explorer');
                  }}
                >
                  Launch Explorer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="secondary"
                  className="w-full text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToConversations();
                  }}
                >
                  View More Conversations
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Parameter Explorer Card - Bottom on mobile, Right on desktop */}
          <Card
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-emerald-300 bg-white flex flex-col"
            onClick={() => onNavigate('parameter-explorer')}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                  <Settings className="w-6 h-6 text-emerald-600" />
                </div>
                <CardTitle className="text-xl text-slate-800">
                  Advanced: Parameter Explorer
                </CardTitle>
              </div>
              <CardDescription className="text-slate-600">
                Configure and analyze conversation parameters with multiple visualization plots and detailed configuration options
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col flex-1">
              <div className="space-y-3 mb-6 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Configure pipeline parameters</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Multiple plot comparisons</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span>Statement analysis tools</span>
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full group-hover:bg-emerald-50 group-hover:border-emerald-400 transition-colors mt-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('parameter-explorer');
                }}
              >
                Configure Parameters
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Conversation Showcase Section */}
        <div className="mt-20 max-w-6xl mx-auto conversation-showcase-section">
          <ConversationListing
            conversations={conversations}
            loading={loading}
            error={error}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-16 pb-8">
          <p className="text-sm text-slate-500">
            Choose a tool above to begin exploring your conversation data, or browse the showcase below
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;