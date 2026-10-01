import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShoppingBag, UserPlus, LogIn } from "lucide-react";

interface AuthPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  size?: string;
  quantity?: number;
}

export default function AuthPromptModal({
  isOpen,
  onClose,
  productName,
  size,
  quantity = 1,
}: AuthPromptModalProps) {
  const navigate = useNavigate();

  const handleSignIn = () => {
    onClose();
    navigate("/login?redirect=/cart");
  };

  const handleCreateAccount = () => {
    onClose();
    navigate("/register?redirect=/cart");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl bg-card border border-border shadow-xl">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-full bg-[#11291F]/10 flex items-center justify-center mb-3">
            <ShoppingBag className="w-6 h-6 text-[#11291F]" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            Sign in or create an account to continue
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Your selected product is saved and will be automatically added to your cart as soon as you sign in.
          </DialogDescription>
        </DialogHeader>

        {productName && (
          <div className="my-2 p-3.5 bg-muted/40 rounded-xl border border-border/80 flex items-center justify-between text-xs">
            <div>
              <p className="font-semibold text-foreground">{productName}</p>
              {size && <p className="text-muted-foreground mt-0.5">{size}</p>}
            </div>
            <span className="font-semibold text-[#11291F] bg-[#11291F]/10 px-2 py-1 rounded-md">
              Qty: {quantity}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2.5 mt-4">
          <Button
            onClick={handleSignIn}
            className="w-full h-11 bg-[#11291F] hover:bg-[#1E3A2C] text-white font-medium flex items-center justify-center gap-2 text-sm shadow-xs"
            data-testid="auth-prompt-signin-btn"
          >
            <LogIn size={16} />
            <span>Sign In</span>
          </Button>

          <Button
            variant="outline"
            onClick={handleCreateAccount}
            className="w-full h-11 font-medium flex items-center justify-center gap-2 text-sm border-border hover:bg-muted"
            data-testid="auth-prompt-register-btn"
          >
            <UserPlus size={16} />
            <span>Create Account</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
