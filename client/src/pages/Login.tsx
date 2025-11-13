import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X } from "lucide-react";
import {
  useLoginMutation,
  useRegisterMutation,
  useMeQuery,
} from "@/features/auth/queries";
import { toast } from "sonner";

export default function Login() {
  const navigate = useNavigate();

  // 로그인 폼 상태
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // 회원가입 모달 상태
  const [openRegister, setOpenRegister] = useState(false);
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();

  // 수동 me 요청 용도
  const { refetch: refetchMe } = useMeQuery({ enabled: false });

  const getErrorMessage = (err: unknown): string | undefined => {
    if (err instanceof Error) return err.message;
    if (typeof err === "object" && err && "message" in err) {
      const m = (err as { message?: unknown }).message;
      return typeof m === "string" ? m : undefined;
    }
    return undefined;
  };

  const doAfterAuth = async () => {
    try {
      await refetchMe();
      navigate("/lobby", { replace: true });
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? "인증 상태 확인에 실패했습니다.");
    }
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      return toast.error("아이디와 비밀번호를 입력하세요.");
    }
    try {
      await loginMutation.mutateAsync({
        username: username.trim(),
        password: password.trim(),
      });
      await refetchMe();
      await doAfterAuth();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? "로그인에 실패했습니다.");
    }
  };

  const handleRegister = async () => {
    if (!regUsername.trim() || !regPassword.trim()) {
      return toast.error("아이디와 비밀번호를 입력하세요.");
    }
    try {
      await registerMutation.mutateAsync({
        username: regUsername.trim(),
        password: regPassword.trim(),
      });
      toast.success("회원가입이 완료되었습니다. 자동 로그인합니다.");
      await loginMutation.mutateAsync({
        username: regUsername.trim(),
        password: regPassword.trim(),
      });
      setOpenRegister(false);
      setUsername(regUsername.trim());
      setPassword(regPassword.trim());
      await refetchMe();
      await doAfterAuth();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) ?? "회원가입에 실패했습니다.");
    }
  };

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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">아이디</label>
              <Input
                type="text"
                name="username"
                autoComplete="username"
                placeholder="아이디를 입력하세요"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">비밀번호</label>
              <Input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                size="lg"
                onClick={() => setOpenRegister(true)}
              >
                회원가입
              </Button>
            </div>
          </form>
        </div>
      </div>

      {openRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg p-6 shadow-lg w-full max-w-md relative">
            <button
              aria-label="close"
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              onClick={() => setOpenRegister(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">회원가입</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRegister();
              }}
              className="space-y-3"
            >
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">아이디</label>
                <Input
                  type="text"
                  name="username"
                  autoComplete="username"
                  placeholder="아이디를 입력하세요"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">비밀번호</label>
                <Input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  placeholder="비밀번호를 입력하세요"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                className="w-full mt-2"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? "가입 중..." : "가입하기"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}