import OneFixApp from '@/components/onefix-app';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <OneFixApp view="report" facilityId={(await params).id} />;
}
