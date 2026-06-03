import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GraduationCap, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { tutorialSteps } from './tutorialSteps';

export function TutorialOverlay() {
  const { t } = useTranslation();
  const [closed, setClosed] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === tutorialSteps.length - 1;
  const step = tutorialSteps[stepIndex];

  const handleNext = () => {
    if (isLast) {
      setClosed(true);
      return;
    }
    setStepIndex((i) => Math.min(i + 1, tutorialSteps.length - 1));
  };

  const handlePrev = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSkip = () => {
    setClosed(true);
  };

  const handleReopen = () => {
    setStepIndex(0);
    setClosed(false);
  };

  if (closed) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className="fixed bottom-4 right-4 z-50 shadow-lg"
        onClick={handleReopen}
      >
        <GraduationCap className="mr-2 h-4 w-4" />
        {t('tutorial.replay')}
      </Button>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <Card className="pointer-events-auto w-full max-w-xl shadow-xl">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">
              {t('tutorial.progress', { current: stepIndex + 1, total: tutorialSteps.length })}
            </p>
            <CardTitle className="text-lg">{t(step.titleKey)}</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('tutorial.close')}
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">{t(step.bodyKey)}</p>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              {t('tutorial.skip')}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={isFirst}>
                {t('tutorial.prev')}
              </Button>
              <Button size="sm" onClick={handleNext}>
                {isLast ? t('tutorial.start') : t('tutorial.next')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
