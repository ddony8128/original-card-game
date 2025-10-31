import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Home } from "lucide-react";

export default function Result() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-background to-accent/10 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          <Trophy className="w-20 h-20 text-amber-500 mx-auto" />
          <div>
            <h1 className="text-3xl font-bold mb-2">게임 종료</h1>
            <p className="text-muted-foreground">
              전적 통계 및 결과가 여기에 표시됩니다
            </p>
          </div>
          
          <div className="space-y-3 pt-4">
            <Button onClick={() => navigate("/lobby")} className="w-full" size="lg">
              <Home className="w-4 h-4 mr-2" />
              로비로 돌아가기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
