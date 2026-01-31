import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Image, Trash2 } from 'lucide-react';
import AdminLayout from './AdminLayout';

export default function Media() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Media Library</h1>
            <p className="text-muted-foreground">Manage images and video URLs</p>
          </div>
          <Button data-testid="button-upload-media">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Uploaded Media</CardTitle>
            <CardDescription>Images and videos used across your landing page</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-12 text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No media uploaded yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload images for your hero section, testimonials, and more
              </p>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload Files
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
