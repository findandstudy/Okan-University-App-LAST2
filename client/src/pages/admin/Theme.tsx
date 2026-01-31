import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Palette } from 'lucide-react';
import AdminLayout from './AdminLayout';

const FONT_OPTIONS = ['Inter', 'Open Sans', 'Roboto', 'Poppins', 'Montserrat'];
const BUTTON_STYLES = ['rounded', 'pill', 'square'];

export default function Theme() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    primaryColor: '#2563eb',
    secondaryColor: '#3b82f6',
    backgroundColor: '#ffffff',
    textColor: '#1f2937',
    fontFamily: 'Inter',
    buttonStyle: 'rounded',
  });

  const handleSave = () => {
    toast({
      title: 'Theme saved',
      description: 'Theme settings have been updated.',
    });
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Theme Settings</h1>
          <p className="text-muted-foreground">Customize the look and feel of your landing page</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Colors</CardTitle>
              <CardDescription>Define your brand colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Primary Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, primaryColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.primaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, primaryColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-primary-color"
                    />
                  </div>
                </div>

                <div>
                  <Label>Secondary Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, secondaryColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.secondaryColor}
                      onChange={(e) =>
                        setSettings({ ...settings, secondaryColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-secondary-color"
                    />
                  </div>
                </div>

                <div>
                  <Label>Background Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.backgroundColor}
                      onChange={(e) =>
                        setSettings({ ...settings, backgroundColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.backgroundColor}
                      onChange={(e) =>
                        setSettings({ ...settings, backgroundColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-background-color"
                    />
                  </div>
                </div>

                <div>
                  <Label>Text Color</Label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      type="color"
                      value={settings.textColor}
                      onChange={(e) =>
                        setSettings({ ...settings, textColor: e.target.value })
                      }
                      className="h-10 w-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={settings.textColor}
                      onChange={(e) =>
                        setSettings({ ...settings, textColor: e.target.value })
                      }
                      className="flex-1"
                      data-testid="input-text-color"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography & Buttons</CardTitle>
              <CardDescription>Font and button styling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Font Family</Label>
                <Select
                  value={settings.fontFamily}
                  onValueChange={(value) =>
                    setSettings({ ...settings, fontFamily: value })
                  }
                >
                  <SelectTrigger className="mt-1.5" data-testid="select-font-family">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Button Style</Label>
                <Select
                  value={settings.buttonStyle}
                  onValueChange={(value) =>
                    setSettings({ ...settings, buttonStyle: value })
                  }
                >
                  <SelectTrigger className="mt-1.5" data-testid="select-button-style">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUTTON_STYLES.map((style) => (
                      <SelectItem key={style} value={style}>
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4">
                <Label className="text-muted-foreground">Preview</Label>
                <div className="mt-2 p-4 border rounded-lg">
                  <Button style={{ backgroundColor: settings.primaryColor }}>
                    Primary Button
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} data-testid="button-save-theme">
            Save Changes
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
