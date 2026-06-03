import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLangNavigate } from '@/i18n/nav';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateReviewMutation } from '@/features/reviews/queries';

export default function Review() {
  const navigate = useLangNavigate();
  const { t } = useTranslation();
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const createReview = useCreateReviewMutation();

  const handleSubmit = async () => {
    if (!review.trim()) {
      toast.error(t('review.errEmpty'));
      return;
    }

    try {
      setSubmitting(true);
      await createReview.mutateAsync({ review: review.trim() });

      toast.success(t('review.success'), {
        description: t('review.successDesc'),
      });
      setReview('');
      navigate('/lobby');
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : t('review.errSubmit');
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
          {t('common.backToLobby')}
        </Button>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 items-center justify-center">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-center text-3xl">{t('review.title')}</CardTitle>
            <CardDescription className="pt-2 text-center text-base">
              {t('review.descriptionLine1')}
              <br />
              {t('review.descriptionLine2')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder={t('review.placeholder')}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              className="min-h-[300px] resize-none"
              disabled={submitting}
            />
            <Button onClick={handleSubmit} className="w-full" size="lg" disabled={submitting}>
              {submitting ? t('review.submitting') : t('review.submit')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
