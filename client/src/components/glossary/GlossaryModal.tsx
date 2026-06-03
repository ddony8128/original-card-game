import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface GlossaryTerm {
  term: string;
  def: string;
}

interface GlossaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlossaryModal({ open, onOpenChange }: GlossaryModalProps) {
  const { t } = useTranslation();
  const terms = t('glossary.terms', { returnObjects: true }) as GlossaryTerm[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('glossary.title')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <dl className="space-y-4">
            {Array.isArray(terms) &&
              terms.map((entry, index) => (
                <div key={`${entry.term}-${index}`} className="space-y-1">
                  <dt className="text-sm font-semibold">{entry.term}</dt>
                  <dd className="text-muted-foreground text-sm leading-relaxed">{entry.def}</dd>
                </div>
              ))}
          </dl>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
