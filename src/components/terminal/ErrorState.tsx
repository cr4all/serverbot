'use client';

export default function ErrorState({ message }: { message: string }) {
  return <div className="pt-error">{message}</div>;
}
