export const dynamic = 'force-dynamic'

import FormBuilder from '@/components/app/FormBuilder'

export default async function FormBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FormBuilder formId={id} />
}
