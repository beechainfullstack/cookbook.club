import { Text, View } from 'react-native';
import { Brand, Body, Button, Heading, Screen, styles } from '../components/ui';
import type { Message } from '../lib/data';

export function HomeScreen({ lastMessage, onEdit, onSettings }: { lastMessage: Message | null; onEdit: () => void; onSettings: () => void }) {
  return <Screen>
    <View style={styles.row}><Brand /><Button title="Settings" onPress={onSettings} quiet /></View>
    <Heading>{lastMessage ? 'Your last note.' : 'You’re all set.'}</Heading>
    <View style={styles.card}>
      {lastMessage ? <>
        <Text style={[styles.body, { color: styles.heading.color }]}>{lastMessage.content}</Text>
        <Text style={styles.label}>{lastMessage.sent_at ? new Date(lastMessage.sent_at).toLocaleDateString() : ''}</Text>
      </> : <Body>Your answers are saved. Your first check-in will appear here when messaging is ready.</Body>}
    </View>
    <Button title="Edit survey answers" quiet onPress={onEdit} />
  </Screen>;
}
