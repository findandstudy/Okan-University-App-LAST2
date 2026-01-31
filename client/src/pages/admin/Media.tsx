import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Trash2, Loader2, ExternalLink } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useUpload } from '@/hooks/use-upload';
import AdminLayout from './AdminLayout';
import type { MediaAsset } from '@shared/schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Media() {
  const { toast } = useToast();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');

  const { data: mediaAssets = [], isLoading } = useQuery<MediaAsset[]>({
    queryKey: ['/api/media'],
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      if (selectedFile) {
        await saveMediaMutation.mutateAsync({
          fileName: selectedFile.name,
          fileUrl: response.objectPath,
          fileType: selectedFile.type.startsWith('image/') ? 'image' : 'video',
          fileSize: selectedFile.size,
          altText: altText || selectedFile.name,
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Upload Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const saveMediaMutation = useMutation({
    mutationFn: async (data: {
      fileName: string;
      fileUrl: string;
      fileType: string;
      fileSize: number;
      altText: string;
    }) => {
      const response = await apiRequest('POST', '/api/media', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: 'Upload Complete',
        description: 'Media file uploaded successfully.',
      });
      setUploadDialogOpen(false);
      setSelectedFile(null);
      setAltText('');
    },
    onError: () => {
      toast({
        title: 'Save Failed',
        description: 'Failed to save media metadata.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/media/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: 'Deleted',
        description: 'Media file deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete media file.',
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (selectedFile) {
      await uploadFile(selectedFile);
    }
  };

  const getFileUrl = (fileUrl: string) => {
    if (fileUrl.startsWith('http')) return fileUrl;
    return fileUrl;
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Media Library</h1>
            <p className="text-muted-foreground">Manage images and video URLs</p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-upload-media">
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Media</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="file">Select File</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="mt-1.5"
                    data-testid="input-media-file"
                  />
                </div>
                {selectedFile && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
                <div>
                  <Label htmlFor="altText">Alt Text (optional)</Label>
                  <Input
                    id="altText"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    placeholder="Describe the image..."
                    className="mt-1.5"
                    data-testid="input-alt-text"
                  />
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading || saveMediaMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-upload"
                >
                  {isUploading || saveMediaMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload File
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Media</CardTitle>
            <CardDescription>Images and videos used across your landing page</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : mediaAssets.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg p-12 text-center">
                <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No media uploaded yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload images for your hero section, testimonials, and more
                </p>
                <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mediaAssets.map((asset) => (
                  <div
                    key={asset.id}
                    className="relative group border rounded-lg overflow-hidden"
                    data-testid={`media-item-${asset.id}`}
                  >
                    {asset.fileType === 'image' ? (
                      <img
                        src={getFileUrl(asset.fileUrl)}
                        alt={asset.altText || asset.fileName}
                        className="w-full h-32 object-cover"
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted flex items-center justify-center">
                        <ExternalLink className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-medium truncate">{asset.fileName}</p>
                      {asset.fileSize && (
                        <p className="text-xs text-muted-foreground">
                          {(asset.fileSize / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteMutation.mutate(asset.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-media-${asset.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
