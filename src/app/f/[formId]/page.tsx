import FormFill from '@/components/public/FormFill'

export const dynamic = 'force-dynamic'

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ formId: string }>
}) {
  const { formId } = await params
  return <FormFill formId={formId} />
}
