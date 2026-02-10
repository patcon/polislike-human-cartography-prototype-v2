import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { App } from './App';
import type { PreloadedData } from './App';
import { loadH5adFile } from '../../lib/h5ad-loader';
import type { H5adData } from '../../lib/h5ad-loader';

/**
 * Wrapper component that provides a file picker for loading h5ad files,
 * parses them with h5wasm, and renders the App with preloaded data.
 */
function H5adFileLoader() {
  const [data, setData] = React.useState<H5adData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedEmbedding, setSelectedEmbedding] = React.useState<string | null>(null);

  const handleFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await loadH5adFile(buffer);
      setData(parsed);
      // Set the initially-selected embedding (first in preferred order)
      const preferredOrder = ['X_localmap', 'X_umap', 'X_pacmap'];
      const defaultEmbedding = preferredOrder.find(k => parsed.availableEmbeddings.includes(k))
        ?? parsed.availableEmbeddings[0];
      setSelectedEmbedding(defaultEmbedding);
    } catch (err) {
      console.error('Failed to load h5ad file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse h5ad file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleEmbeddingChange = React.useCallback(async (newEmbedding: string) => {
    if (!data) return;
    setSelectedEmbedding(newEmbedding);
    setLoading(true);
    setError(null);

    try {
      // Re-read the file from the emscripten FS isn't possible after close,
      // so we need the user to re-upload. Instead, store the buffer.
      // For simplicity, we ask user to re-select. But actually we can
      // use the fileInputRef to get the file again.
      const fileInput = document.querySelector<HTMLInputElement>('#h5ad-file-input');
      const file = fileInput?.files?.[0];
      if (!file) {
        setError('Please re-select the file to change embeddings');
        setLoading(false);
        return;
      }
      const buffer = await file.arrayBuffer();
      const parsed = await loadH5adFile(buffer, newEmbedding);
      setData(parsed);
    } catch (err) {
      console.error('Failed to reload with new embedding:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload embedding');
    } finally {
      setLoading(false);
    }
  }, [data]);

  // File picker screen
  if (!data) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center p-8">
          <h2 className="text-xl font-semibold">Load AnnData File</h2>
          <p className="text-sm text-muted-foreground">
            Select an <code>.h5ad</code> file exported from{' '}
            <span className="font-medium">valency-anndata</span> or any AnnData-compatible tool.
            The file should contain participant embeddings in <code>obsm/</code>,
            statement metadata in <code>var/</code>, and optionally votes in <code>uns/votes</code>.
          </p>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <label
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer
              hover:bg-accent hover:text-accent-foreground transition-colors
              ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {loading ? 'Loading...' : 'Choose .h5ad file'}
            <input
              id="h5ad-file-input"
              type="file"
              accept=".h5ad,.h5,.hdf5"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        </div>
      </div>
    );
  }

  const preloadedData: PreloadedData = {
    dataset: data.dataset,
    statements: data.statements,
    votesRows: data.votesRows,
  };

  return (
    <div className="relative h-screen w-screen">
      {/* Embedding selector overlay */}
      {data.availableEmbeddings.length > 1 && (
        <div className="absolute top-2 left-2 z-[100] pointer-events-auto">
          <select
            value={selectedEmbedding ?? ''}
            onChange={(e) => handleEmbeddingChange(e.target.value)}
            disabled={loading}
            className="text-xs px-2 py-1 rounded border bg-background/90 backdrop-blur-sm shadow-sm"
          >
            {data.availableEmbeddings.map((key) => (
              <option key={key} value={key}>
                {key.replace(/^X_/, '')}
              </option>
            ))}
          </select>
        </div>
      )}
      {loading && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center bg-background/50">
          <p className="text-sm text-muted-foreground">Switching embedding...</p>
        </div>
      )}
      <App preloadedData={preloadedData} />
    </div>
  );
}

const meta: Meta = {
  title: 'Components/App/H5AD Mode',
  component: H5adFileLoader,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
Load all conversation data from a single \`.h5ad\` (AnnData) file.

This enables exploring any AnnData-exported Polis conversation without needing
a Kedro server or pre-exported JSON files. The file picker loads projections,
statements, and votes directly in the browser using h5wasm.

**Expected h5ad structure:**
- \`obs\` — participant index (IDs)
- \`obsm/X_*\` — 2D embeddings (e.g. \`X_localmap\`, \`X_umap\`)
- \`var\` — statement index + \`content\` and \`moderation_state\` columns
- \`uns/votes\` — DataFrame with \`voter_id\`, \`comment_id\`, \`vote\` columns
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <H5adFileLoader />,
};
