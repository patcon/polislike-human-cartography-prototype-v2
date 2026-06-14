import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App';
import type { PreloadedData } from './App';
import { loadH5adFile } from '../../lib/h5ad-loader';

/**
 * Wrapper component that provides a file picker for loading h5ad files,
 * parses them with h5wasm, and renders the App with preloaded data.
 * Embedding switching is handled by D3Map's MapProjectionSelector with animation.
 */
function H5adFileLoader() {
  const [preloadedData, setPreloadedData] = React.useState<PreloadedData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleLoadFile = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await loadH5adFile(buffer);
      setPreloadedData({
        dataset: parsed.dataset,
        statements: parsed.statements,
        votesRows: parsed.votesRows,
        pipelineData: parsed.allEmbeddings,
        fullDimensionEmbeddings: parsed.fullDimensionEmbeddings,
        obsColumns: parsed.obsColumns,
      });
    } catch (err) {
      console.error('Failed to load h5ad file:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse h5ad file');
    } finally {
      setLoading(false);
      // Reset so re-selecting the same file triggers onChange again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // File picker screen
  if (!preloadedData) {
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".h5ad,.h5,.hdf5"
            onChange={handleFileChange}
            className="sr-only"
          />
          <button
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md border cursor-pointer
              hover:bg-accent hover:text-accent-foreground transition-colors
              ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            onClick={handleLoadFile}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Choose .h5ad file'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".h5ad,.h5,.hdf5"
        onChange={handleFileChange}
        className="sr-only"
      />
      <App preloadedData={preloadedData} onLoadFile={handleLoadFile} />
    </>
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
- \`uns/votes\` — DataFrame with \`voter-id\`, \`comment-id\`, \`vote\` columns
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
