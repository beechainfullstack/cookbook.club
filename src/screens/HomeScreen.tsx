import { Text, View } from 'react-native';
import { Brand, Body, Button, Heading, Screen, styles } from '../components/ui';
import { saveFeedback, type Feedback, type Message } from '../lib/data';
import { FeedbackForm } from '../components/FeedbackForm';

export function HomeScreen({ userId, lastMessage, lastFeedback, onEdit, onSettings }: { userId: string; lastMessage: Message | null; lastFeedback: Feedback | null; onEdit: () => void; onSettings: () => void }) {
  return <Screen>
    <View style={styles.row}><Brand /><Button title="Settings" onPress={onSettings} quiet /></View>
    <Heading>{lastMessage ? 'Your last note.' : 'You’re all set.'}</Heading>
    <View style={styles.card}>
      {lastMessage ? <>
        <Text style={[styles.body, { color: styles.heading.color }]}>{lastMessage.content}</Text>
        <Text style={styles.label}>{lastMessage.sent_at ? new Date(lastMessage.sent_at).toLocaleDateString() : ''}</Text>
      </> : <Body>Your answers are saved. Your first check-in will appear here after it’s sent.</Body>}
    </View>
    {lastMessage && <FeedbackForm key={`${lastMessage.id}:${lastFeedback?.rating ?? ''}:${lastFeedback?.comment ?? ''}`}
      initialRating={lastFeedback?.rating as -1 | 1 | undefined} initialComment={lastFeedback?.comment ?? ''} alreadySaved={Boolean(lastFeedback)}
      onSave={(rating, comment) => saveFeedback(userId, lastMessage.id, rating, comment)} />}
    <Button title="Edit survey answers" quiet onPress={onEdit} />
  </Screen>;
}
