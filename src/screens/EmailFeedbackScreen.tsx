import { Brand, Body, Heading, Screen } from '../components/ui';
import { FeedbackForm } from '../components/FeedbackForm';

export function EmailFeedbackScreen({ token, rating }: { token: string; rating: -1 | 1 | null }) {
  return <Screen><Brand /><Heading>A little feedback.</Heading><Body>No sign-in needed. Your feedback helps shape future notes.</Body>
    <FeedbackForm initialRating={rating} onSave={async (value, comment) => {
      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/email-feedback`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, rating: value, comment }),
      });
      if (!response.ok) throw new Error('Could not save feedback');
    }} />
    <Body>Links expire after 30 days. You can also give feedback on your latest note in the app.</Body>
  </Screen>;
}
