import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateReviewMutation } from '@/features/reviews/queries';

export default function Review() {
  const navigate = useNavigate();
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const createReview = useCreateReviewMutation();

  const handleSubmit = async () => {
    if (!review.trim()) {
      toast.error('리뷰를 입력해주세요.');
      return;
    }

    try {
      setSubmitting(true);
      await createReview.mutateAsync({ review: review.trim() });

      toast.success('리뷰가 등록되었습니다.', {
        description: '소중한 의견 감사합니다!',
      });
      setReview('');
      navigate('/lobby');
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : '리뷰 등록 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col p-4">
      {/* 상단 헤더 */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/lobby')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          로비로 돌아가기
        </Button>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center text-3xl">게임 리뷰</CardTitle>
            <CardDescription className="pt-2 text-center text-base">
              게임이 재미있었던 점, 아쉬웠던 점, 이런 카드 있으면 좋겠다 등
              <br />
              자유롭게 적어주세요!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="여기에 리뷰를 작성해주세요..."
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-[300px] resize-none"
              disabled={submitting}
            />
            <Button onClick={handleSubmit} className="w-full" size="lg" disabled={submitting}>
              {submitting ? '등록 중...' : '리뷰 등록'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
