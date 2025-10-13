import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, BarChart3, Github, Eye, Settings, Workflow } from 'lucide-react';
import type { ConversationListingProps } from './types';

export const ConversationListing: React.FC<ConversationListingProps> = ({ 
  conversations, 
  loading = false, 
  error 
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading conversations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">Error loading conversations: {error}</div>
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">No conversations found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800 mb-4">
          Conversation Showcase
        </h2>
        <p className="text-lg text-slate-600 max-w-3xl mx-auto">
          Explore real-world conversations analyzed with our tools. Each conversation includes interactive visualizations and detailed reports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {conversations.map((conversation, index) => (
          <Card key={index} className="group hover:shadow-xl transition-all duration-300 border-2 hover:border-slate-300 bg-white flex flex-col overflow-hidden">
            {/* Image Section */}
            <div className="relative w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 rounded-t-lg overflow-hidden -mt-6">
              {conversation.image_url ? (
                <img
                  src={conversation.image_url}
                  alt={`Preview for ${conversation.name}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback to placeholder if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`absolute inset-0 flex items-center justify-center ${conversation.image_url ? 'hidden' : ''}`}>
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 bg-slate-300 rounded-lg shadow-inner flex items-center justify-center">
                    <Eye className="w-8 h-8 text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">Preview Coming Soon</p>
                </div>
              </div>
              {/* Subtle overlay for better text readability if needed */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            
            <CardHeader className="pb-4">
              <div className="mb-2">
                <CardTitle className="text-lg text-slate-800 leading-tight">
                  {conversation.name}
                </CardTitle>
              </div>
              {conversation.notes && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {conversation.notes.split(/[,.]+/).map((note, noteIndex) => {
                    const trimmedNote = note.trim();
                    return trimmedNote ? (
                      <Badge key={noteIndex} variant="secondary" className="text-xs">
                        {trimmedNote}
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
              {conversation.description && (
                <CardDescription className="text-slate-600">
                  {conversation.description}
                </CardDescription>
              )}
            </CardHeader>
            
            <CardContent className="flex flex-col flex-1">
              <div className="space-y-4 flex-1">
                {/* Explorer Actions */}
                {(conversation.simple_explorer_url || conversation.advanced_explorer_url) && (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide w-16 flex-shrink-0 mr-2 text-right">Explorers</div>
                      <div className="flex gap-2 flex-1">
                        {conversation.simple_explorer_url && (
                          <Button
                            asChild
                            size="sm"
                            className="text-xs h-8 justify-start bg-blue-600 hover:bg-blue-700 flex-1"
                          >
                            <a
                              href={conversation.simple_explorer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Simple
                            </a>
                          </Button>
                        )}
                        {conversation.advanced_explorer_url && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 justify-start border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex-1"
                          >
                            <a
                              href={conversation.advanced_explorer_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Settings className="w-3 h-3 mr-1" />
                              Advanced
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Polis Section */}
                {(conversation.polis_convo_url || conversation.polis_report_url) && (
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide w-16 flex-shrink-0 mr-2 text-right">Polis</div>
                      <div className="flex gap-2 flex-1">
                        {conversation.polis_convo_url && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 justify-start flex-1"
                          >
                            <a
                              href={conversation.polis_convo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageSquare className="w-3 h-3 mr-1" />
                              Convo
                            </a>
                          </Button>
                        )}
                        {conversation.polis_report_url && (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 justify-start flex-1"
                          >
                            <a
                              href={conversation.polis_report_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <BarChart3 className="w-3 h-3 mr-1" />
                              Report
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pipeline Section */}
                {(conversation.pipeline_repo_url || conversation.pipeline_viz_url) && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide w-16 flex-shrink-0 mr-2 text-right">Pipeline</div>
                      <div className="flex gap-2 flex-1">
                        {conversation.pipeline_repo_url && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 justify-start text-slate-600 hover:text-slate-800 flex-1"
                          >
                            <a
                              href={conversation.pipeline_repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Github className="w-3 h-3 mr-1" />
                              Code
                            </a>
                          </Button>
                        )}
                        {conversation.pipeline_viz_url && (
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 justify-start text-slate-600 hover:text-slate-800 flex-1"
                          >
                            <a
                              href={conversation.pipeline_viz_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Workflow className="w-3 h-3 mr-1" />
                              Visualization
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ConversationListing;