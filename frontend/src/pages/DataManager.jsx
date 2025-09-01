import React from 'react';
import { Upload, File, AlertCircle, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createApiUrl } from '@/lib/api';
import SideChatbot from '@/components/SideChatbot';

export default function DataManager() {
  const [files, setFiles] = React.useState([]);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [s3Files, setS3Files] = React.useState({ files: [], totalFiles: 0, totalSize: 0 });
  const [loading, setLoading] = React.useState(false);
  const fileInputRef = React.useRef(null);

  // Update call context for chatbot
  React.useEffect(() => {
    const context = {
      page: 'data-manager',
      files: files.map(f => f.name),
      s3Files: s3Files.files?.map(f => f.name) || []
    };
    // Make context available globally for the SideChatbot
    window.callContext = context;
  }, [files, s3Files]);

  const acceptedFileTypes = {
    'text/plain': {
      icon: File,
      label: 'Text',
    },
    'application/pdf': {
      icon: File,
      label: 'PDF',
    },
    'image/jpeg': {
      icon: File,
      label: 'Image',
    },
    'image/png': {
      icon: File,
      label: 'Image',
    },
    'audio/wav': {
      icon: File,
      label: 'Audio',
    },
    'audio/mpeg': {
      icon: File,
      label: 'Audio',
    },
  };

  const fetchS3Files = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analysis');
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      const data = await response.json();
      console.log('API Response:', data);
      setS3Files(data);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchS3Files();
  }, []);

  const handleFileSelect = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
    setError(null);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select files to upload');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      setFiles([]);
      fileInputRef.current.value = '';
      alert('Files uploaded successfully!');
      fetchS3Files(); // Refresh the file list
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      // Remove the knowledge-base/ prefix from the fileId
      const filename = fileId.replace('knowledge-base/', '');
      
      const response = await fetch(`/api/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete file');
      }

      // Refresh the files list after deletion
      fetchS3Files();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="grid gap-8 grid-cols-1 md:grid-cols-[2fr,1fr]">
        <div className="space-y-8">
          {/* Upload Section */}
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Data Manager</h1>
            <p className="text-muted-foreground">
              Upload and manage your files. Supported formats: Text, PDF, Images, and Audio files.
            </p>

            <div className="border border-border rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer border-border hover:bg-accent/50">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Text, PDF, Images, and Audio files
                    </p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={handleFileSelect}
                    accept=".txt,.pdf,.jpg,.jpeg,.png,.wav,.mp3"
                  />
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Selected Files:</h3>
                  <div className="grid gap-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center p-2 border border-border rounded-md"
                      >
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="w-full"
              >
                {uploading ? 'Uploading...' : 'Upload Files'}
              </Button>
            </div>
          </div>

          {/* Files List Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">All Files</h2>
              <p className="text-sm text-muted-foreground">
                Total Files: {s3Files.totalFiles} • Total Size: {(s3Files.totalSize / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              {loading ? (
                <div className="text-center text-muted-foreground p-6">Loading files...</div>
              ) : s3Files.files && s3Files.files.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-4 font-medium">File Name</th>
                        <th className="text-left p-4 font-medium">Upload Date</th>
                        <th className="text-left p-4 font-medium">Size</th>
                        <th className="text-right p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s3Files.files.map((file) => (
                        <tr key={file.id} className="border-t border-border hover:bg-muted/50">
                          <td className="p-4">
                            <span className="font-medium">{file.name}</span>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {new Date(file.lastModified).toLocaleString()}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex items-center justify-center p-2 hover:bg-accent/50 rounded-md transition-colors"
                                title="Download file"
                              >
                                <Download className="w-4 h-4 text-muted-foreground" />
                              </a>
                              <button
                                onClick={() => handleDelete(file.id)}
                                className="inline-flex items-center justify-center p-2 hover:bg-destructive/10 rounded-md transition-colors"
                                title="Delete file"
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-muted-foreground p-6">
                  No files uploaded yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Chatbot - Always visible */}
        <div className="space-y-4">
          <div className="sticky top-4">
            <SideChatbot />
          </div>
        </div>
      </div>
    </div>
  );
} 