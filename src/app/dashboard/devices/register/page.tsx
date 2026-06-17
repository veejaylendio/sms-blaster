'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useSupabase } from '@/components/supabase-provider'; // Import useSupabase

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function RegisterDevicePage() {
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('native');
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredDevice, setRegisteredDevice] = useState<{
    deviceId: string;
    apiKey: string;
    deviceType: string;
  } | null>(null);
  const router = useRouter();
  const supabase = useSupabase();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setRegisteredDevice(null);

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          device_name: deviceName,
          device_type: deviceType,
          gateway_url: deviceType === 'mymobkit' ? gatewayUrl : undefined
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to register device');
      }

      setRegisteredDevice({
        deviceId: data.device_id,
        apiKey: data.api_key,
        deviceType: deviceType,
      });
      
      if (deviceType === 'native') {
        toast.success('Device registered successfully! Scan the QR code with your Android app.');
      } else {
        toast.success('Mymobkit gateway registered successfully!');
      }
    } catch (error: any) {
      toast.error('Registration failed.', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const qrData = registeredDevice
    ? JSON.stringify({
        deviceId: registeredDevice.deviceId,
        apiKey: registeredDevice.apiKey,
        apiUrl: window.location.origin,
      })
    : '';

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Register New SMS Gateway</h1>

      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Register Gateway</CardTitle>
          <CardDescription>
            Choose the type of SMS gateway you want to register.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!registeredDevice ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deviceType">Gateway Type</Label>
                <Select
                  value={deviceType}
                  onValueChange={setDeviceType}
                  disabled={loading}
                >
                  <SelectTrigger id="deviceType">
                    <SelectValue placeholder="Select gateway type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="native">Native Android App (Polling)</SelectItem>
                    <SelectItem value="mymobkit">Mymobkit (Push API)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deviceName">Gateway Name</Label>
                <Input
                  id="deviceName"
                  type="text"
                  placeholder="My Android Phone"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {deviceType === 'mymobkit' && (
                <div className="space-y-2">
                  <Label htmlFor="gatewayUrl">Mymobkit Gateway URL (Optional)</Label>
                  <Input
                    id="gatewayUrl"
                    type="url"
                    placeholder="http://192.168.254.134:1688"
                    value={gatewayUrl}
                    onChange={(e) => setGatewayUrl(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave blank if you have set <code className="bg-muted px-1 rounded">ANDROID_SMS_API_URL</code> in your <code className="bg-muted px-1 rounded">.env</code> file.
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Registering...' : 'Register Gateway'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-lg font-medium">Gateway Registered!</p>
              
              {registeredDevice.deviceType === 'native' ? (
                <>
                  <p className="text-sm text-gray-600">
                    Scan the QR code below with your Android SMS Gateway app.
                  </p>
                  <div className="flex justify-center">
                    <QRCodeCanvas value={qrData} size={256} level="H" />
                  </div>
                  <div className="text-left space-y-2 text-sm">
                    <p>
                      <span className="font-semibold">Device ID:</span>{' '}
                      <span className="break-all">{registeredDevice.deviceId}</span>
                    </p>
                    <p>
                      <span className="font-semibold">API Key:</span>{' '}
                      <span className="break-all">{registeredDevice.apiKey}</span>
                    </p>
                    <p className="text-red-600 font-medium">
                      Important: This API key will only be shown once.
                    </p>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="bg-green-100 text-green-800 p-4 rounded-md mb-4">
                    Mymobkit gateway is now active and ready to send messages.
                  </div>
                  <p className="text-sm text-gray-600">
                    No further configuration is needed on the device.
                  </p>
                </div>
              )}
              
              <Button onClick={() => router.push('/dashboard/devices')} className="w-full">
                Go to Devices List
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

