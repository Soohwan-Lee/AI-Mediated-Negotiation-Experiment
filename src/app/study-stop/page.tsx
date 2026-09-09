import { Page, PageHeader, Card } from "@/components/ui";

export default async function StudyStopPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const withdrawal = reason === "withdrawal";

  return (
    <Page>
      <PageHeader
        eyebrow="Study status"
        title={withdrawal ? "You have stopped the study" : "This task cannot continue"}
        subtitle={
          withdrawal
            ? "You can contact the research team for next steps."
            : "The required understanding check was not passed after two attempts."
        }
      />
      <Card>
        <p className="text-sm leading-relaxed text-slate-700">
          {withdrawal
            ? "Please contact Soohwan Lee at soohwanlee@unist.ac.kr for next steps."
            : "We cannot continue to the next task because this check has not been passed. Please contact Soohwan Lee at soohwanlee@unist.ac.kr for next steps."}
        </p>
      </Card>
    </Page>
  );
}
