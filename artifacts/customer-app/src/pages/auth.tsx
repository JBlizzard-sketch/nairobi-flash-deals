import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLogin, useRegister, useVerifyOtp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { login: setAuthToken } = useAuth();
  const { toast } = useToast();

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [mode, setMode] = useState<"login" | "register">("login");

  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const verifyMutation = useVerifyOtp();

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    if (mode === "login") {
      loginMutation.mutate(
        { data: { phone } },
        {
          onSuccess: (data) => {
            setStep("otp");
            toast({ title: "OTP Sent", description: data.message });
          },
          onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          },
        }
      );
    } else {
      if (!name) return;
      registerMutation.mutate(
        { data: { phone, name } },
        {
          onSuccess: (data) => {
            setStep("otp");
            toast({ title: "OTP Sent", description: data.message });
          },
          onError: (err) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          },
        }
      );
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    verifyMutation.mutate(
      { data: { phone, otp } },
      {
        onSuccess: (data) => {
          setAuthToken(data.token);
          toast({ title: "Success", description: "Successfully authenticated" });
          setLocation("/");
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-primary tracking-tighter">NFD.</CardTitle>
          <CardDescription>
            {step === "phone" ? "Enter your phone number to continue" : "Enter the verification code"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                {mode === "register" && (
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      placeholder="Jane Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={mode === "register"}
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+254700000000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loginMutation.isPending || registerMutation.isPending}
                >
                  {(loginMutation.isPending || registerMutation.isPending) ? "Sending..." : "Continue"}
                </Button>
              </form>
            </Tabs>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full"
                onClick={() => setStep("phone")}
              >
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
