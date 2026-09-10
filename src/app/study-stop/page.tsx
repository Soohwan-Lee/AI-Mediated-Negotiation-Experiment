import { Page, PageHeader, Card } from "@/components/ui";
import { STUDY } from "@/lib/study-config";

export default async function StudyStopPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const withdrawal = reason === "withdrawal";
  const technical = reason === "technical";

  return (
    <Page>
      <PageHeader
        eyebrow="Study status"
        title={withdrawal ? "You have stopped the study" : "This task cannot continue"}
        subtitle={
          withdrawal
            ? "You can contact the research team for next steps."
            : technical
              ? "The task was interrupted after it began and cannot be restarted safely."
              : "Please contact the research team for next steps."
        }
      />
      <Card>
        <p className="text-sm leading-relaxed text-slate-700">
          {withdrawal
            ? `Please contact ${STUDY.irb.principalInvestigator} at ${STUDY.irb.researcherEmail} for next steps.`
            : technical
              ? `Please contact ${STUDY.irb.principalInvestigator} at ${STUDY.irb.researcherEmail} and mention that the task was interrupted.`
              : `Please contact ${STUDY.irb.principalInvestigator} at ${STUDY.irb.researcherEmail} for next steps.`}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          You can also message the researcher through Prolific. Explain where the study
          stopped and ask how to handle your submission and payment. A completion code
          is not available for this stopped session.
        </p>
      </Card>
    </Page>
  );
}
