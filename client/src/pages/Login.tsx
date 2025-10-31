import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/useGameStore";
import type { User } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles } from "lucide-react";

export default function Login() {
    const navigate = useNavigate();
    const { setUser } = useGameStore();
    const [name, setName] = useState<string>("");


    const handleLogin = () => {
        if (!name.trim()) return;
        const now = Date.now();
        const newUser: User = {
            id: crypto.randomUUID(),
            name: name.trim(),
            decks: [],
            createdAt: now,
            updatedAt: now,
        }
        setUser(newUser);
        navigate("/lobby");
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <Sparkles className="w-20 h-20 text-primary animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">
              마법사 대전
            </h1>
            <p className="text-muted-foreground">카드 게임의 세계에 오신 것을 환영합니다</p>
          </div>
  
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">닉네임</label>
              <Input
                type="text"
                placeholder="닉네임을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full"
              />
            </div>
  
            <Button onClick={handleLogin} className="w-full" size="lg">
              게임 시작
            </Button>
          </div>
        </div>
      </div>
    );
}