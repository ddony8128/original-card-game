export interface TutorialStep {
  /** i18n key for the step title (resolved at render). */
  titleKey: string;
  /** i18n key for the step body (resolved at render). */
  bodyKey: string;
}

export const tutorialSteps: TutorialStep[] = [
  {
    titleKey: 'tutorial.step1Title',
    bodyKey: 'tutorial.step1Body',
  },
  {
    titleKey: 'tutorial.step2Title',
    bodyKey: 'tutorial.step2Body',
  },
  {
    titleKey: 'tutorial.step3Title',
    bodyKey: 'tutorial.step3Body',
  },
  {
    titleKey: 'tutorial.step4Title',
    bodyKey: 'tutorial.step4Body',
  },
  {
    titleKey: 'tutorial.step5Title',
    bodyKey: 'tutorial.step5Body',
  },
  {
    titleKey: 'tutorial.step6Title',
    bodyKey: 'tutorial.step6Body',
  },
];
